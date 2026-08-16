/**
 * Backtest / run Zort → sales_orders delta sync (same as Refresh orders 3d).
 *
 * Usage:
 *   npx tsx scripts/backtest-sync-orders-delta.ts
 *   DAYS=3 npx tsx scripts/backtest-sync-orders-delta.ts
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { fetchSalesOrderRows } from "../src/lib/zortout/order-client"
import { setSyncState, upsertOrderRows } from "../src/lib/sales/order-sheet-writer"
import { getReadOnlySheetsClient } from "../src/lib/google/sheets-readonly"

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

async function readLastDelta(): Promise<string | null> {
    const client = await getReadOnlySheetsClient()
    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!
    const res = await client.spreadsheets.values.get({
        spreadsheetId: id,
        range: "sync_state",
    })
    const rows = res.data.values ?? []
    for (const r of rows.slice(1)) {
        if (String(r[0]) === "orders_last_delta_sync") return String(r[1] ?? "")
    }
    return null
}

async function main() {
    const days = Number(process.env.DAYS) || 3
    const today = ymd(new Date())
    const from = addDays(today, -days)

    console.log("=== BEFORE ===")
    const before = await readLastDelta()
    console.log("orders_last_delta_sync:", before)
    console.log(`Delta window: ${from} → ${today} (${days}d)`)

    const t0 = Date.now()
    const logs: string[] = []
    const { rows, rawOrderCount, droppedOrders, pages } = await fetchSalesOrderRows({
        createdAfter: from,
        createdBefore: today,
        onProgress: (m) => {
            logs.push(m)
            console.log(" ", m)
        },
    })
    console.log(
        `Fetched orders=${rawOrderCount} dropped=${droppedOrders} pages=${pages} lineRows=${rows.length}`,
    )

    console.log("Upserting into sales_orders…")
    const { updated, appended } = await upsertOrderRows(rows)
    await setSyncState("orders_last_delta_sync", new Date().toISOString())

    const after = await readLastDelta()
    console.log("\n=== AFTER ===")
    console.log({
        updated,
        appended,
        elapsedMs: Date.now() - t0,
        orders_last_delta_sync: after,
    })

    if (!after || after === before) {
        console.error("FAIL: sync_state did not advance")
        process.exit(1)
    }
    console.log("PASS — sales_orders delta sync wrote and advanced sync_state")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
