/**
 * Bootstrap script — runs a *full* sync of Zort orders from a configurable
 * start date into the `sales_orders` Google Sheet. Use this for the initial
 * historical backfill since it bypasses the Vercel function timeout entirely.
 *
 * Usage:
 *   npx tsx scripts/sync-orders-bootstrap.ts
 *   FROM=2025-01-01 TO=2026-05-26 npx tsx scripts/sync-orders-bootstrap.ts
 *   WIPE=1 npx tsx scripts/sync-orders-bootstrap.ts   # destructive
 *
 * The script chunks fetches by month to keep memory + per-call payloads
 * manageable (~3-6K orders/month). After a successful run it also sets the
 * `orders_backfill_cursor` to the start date so the in-app backfill route
 * thinks the historical work is already complete.
 */

import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { fetchSalesOrderRows } from "../src/lib/zortout/order-client"
import {
    appendOrderRows,
    clearAllOrderRows,
    setSyncState,
    upsertOrderRows,
} from "../src/lib/sales/order-sheet-writer"

function ymd(d: Date): string {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}
function addDays(yyyymmdd: string, days: number): string {
    const [y, m, d] = yyyymmdd.split("-").map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + days)
    return ymd(dt)
}
function lastDayOfMonth(yyyymmdd: string): string {
    const [y, m] = yyyymmdd.split("-").map(Number)
    return ymd(new Date(Date.UTC(y, m, 0)))
}

async function main() {
    const from = process.env.FROM || "2025-01-01"
    const to = process.env.TO || ymd(new Date())
    const wipe = process.env.WIPE === "1"

    console.log(`Bootstrap sync of orders into sales_orders sheet`)
    console.log(`  Window: ${from} → ${to}`)
    console.log(`  Wipe first: ${wipe}`)
    const t0 = Date.now()

    if (wipe) {
        console.log("\nClearing existing sales_orders rows…")
        await clearAllOrderRows()
    }

    // Walk forward month-by-month so each Zort call stays well under the per-
    // request payload comfort zone and we get incremental progress in stdout.
    let totalRows = 0
    let totalOrders = 0
    let cursor = from
    while (cursor <= to) {
        const chunkEnd = (() => {
            const candidate = lastDayOfMonth(cursor)
            return candidate > to ? to : candidate
        })()
        console.log(`\n──── Chunk ${cursor} → ${chunkEnd} ────`)
        const { rows, rawOrderCount, droppedOrders, pages } = await fetchSalesOrderRows({
            createdAfter: cursor,
            createdBefore: chunkEnd,
            onProgress: (m) => console.log("  " + m),
        })
        console.log(
            `  ✓ ${rawOrderCount} orders (${droppedOrders} dropped, ${rows.length} line items, ${pages} pages)`,
        )
        if (rows.length > 0) {
            if (wipe) {
                // Pure append is fastest after a wipe.
                await appendOrderRows(rows)
            } else {
                // Without a wipe we have to dedupe against whatever's already there.
                const { updated, appended } = await upsertOrderRows(rows)
                console.log(`  written: updated=${updated}, appended=${appended}`)
            }
        }
        totalRows += rows.length
        totalOrders += rawOrderCount
        cursor = addDays(chunkEnd, 1)
    }

    // Tell the in-app backfill route that history has been covered down to FROM.
    await setSyncState("orders_backfill_cursor", from)
    await setSyncState("orders_last_delta_sync", new Date().toISOString())

    const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(
        `\n✓ Bootstrap complete in ${elapsedSec}s — ${totalOrders} orders, ${totalRows} line items.`,
    )
}

main().catch((err) => {
    console.error("\n✗ Bootstrap failed:", err)
    process.exit(1)
})
