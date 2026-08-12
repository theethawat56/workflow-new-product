/**
 * Sync Zortout orders → Google Sheet `sales_orders`.
 *
 * Two modes selected by the `mode` query parameter:
 *
 *   1. `delta` (default) — used by the every-4-hour cron. Re-syncs the trailing N
 *      days (default 3) so status flips (Pending → Success → Voided) and
 *      newly-created orders both land in the sheet. Idempotent via row_id
 *      upsert. Always completes well under 60s for typical daily volume.
 *
 *   2. `backfill` — chunked historical sync. Each invocation processes up to
 *      `chunkDays` (default 14) days going *backwards* from the previously
 *      checkpointed position, stopping early when the budgeted wall time is
 *      about to exceed `BUDGET_MS`. Progress is persisted in the `sync_state`
 *      sheet via `orders_backfill_cursor`, so subsequent invocations (cron,
 *      manual UI clicks, CLI tool) can resume.
 *
 * Auth: NextAuth session OR `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

import { fetchSalesOrderRows } from "@/lib/zortout/order-client"
import {
    appendOrderRows,
    clearAllOrderRows,
    getSyncState,
    setSyncState,
    upsertOrderRows,
} from "@/lib/sales/order-sheet-writer"

export const dynamic = "force-dynamic"
// Vercel maxDuration: hard upper bound for Pro plan is 300s. We self-throttle
// to BUDGET_MS below to leave headroom for sheet writes.
export const maxDuration = 60

const BUDGET_MS = 50_000 // stop kicking off new fetches after ~50s

const SYNC_CURSOR_KEY = "orders_backfill_cursor" // earliest date already synced
const SYNC_LAST_DELTA_KEY = "orders_last_delta_sync"

async function isAuthorized(request: Request): Promise<boolean> {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const header = request.headers.get("authorization") || ""
        if (header === `Bearer ${cronSecret}`) return true
    }
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.email) return true
    } catch {
        /* fall through */
    }
    return false
}

// Date helpers — YYYY-MM-DD arithmetic without dragging in date-fns server-side.
function ymd(d: Date): string {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}
function todayYmd(): string {
    return ymd(new Date())
}
function addDays(yyyymmdd: string, days: number): string {
    const [y, m, d] = yyyymmdd.split("-").map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + days)
    return ymd(dt)
}

// ─── Mode: delta sync (last N days, upsert) ───────────────────────────────────
async function handleDelta(opts: { days: number; logs: string[] }) {
    const today = todayYmd()
    const from = addDays(today, -opts.days)
    opts.logs.push(`Delta sync: ${from} → ${today} (${opts.days} days)`)
    const { rows, rawOrderCount, droppedOrders, pages } = await fetchSalesOrderRows({
        createdAfter: from,
        createdBefore: today,
        onProgress: (m) => opts.logs.push(m),
    })
    opts.logs.push(`Fetched ${rawOrderCount} orders (${droppedOrders} dropped), ${pages} pages`)
    opts.logs.push(`Upserting ${rows.length} line-item rows…`)

    const { updated, appended } = await upsertOrderRows(rows)
    opts.logs.push(`Upsert done — updated=${updated}, appended=${appended}`)
    await setSyncState(SYNC_LAST_DELTA_KEY, new Date().toISOString())

    return {
        mode: "delta",
        window: { from, to: today, days: opts.days },
        stats: { rawOrderCount, droppedOrders, pages, rows: rows.length, updated, appended },
    }
}

// ─── Mode: chunked backfill (state machine) ────────────────────────────────────
async function handleBackfill(opts: {
    chunkDays: number
    targetStart: string
    logs: string[]
}) {
    const t0 = Date.now()
    // Cursor = earliest date already fully synced. Starts at today's date on
    // first run; each chunk pushes it backwards toward `targetStart`.
    const state = await getSyncState(SYNC_CURSOR_KEY)
    let cursor = state?.value || todayYmd()
    opts.logs.push(`Backfill cursor = ${cursor}, target = ${opts.targetStart}`)

    let totalRows = 0
    let totalUpdated = 0
    let totalAppended = 0
    let totalOrders = 0
    let chunksDone = 0

    while (Date.now() - t0 < BUDGET_MS) {
        if (cursor <= opts.targetStart) {
            opts.logs.push(`Cursor reached target — backfill complete.`)
            break
        }
        const chunkEnd = cursor
        const chunkStart = (() => {
            const candidate = addDays(cursor, -opts.chunkDays)
            return candidate < opts.targetStart ? opts.targetStart : candidate
        })()
        opts.logs.push(
            `Chunk ${chunksDone + 1}: ${chunkStart} → ${chunkEnd} (budget left ${(
                (BUDGET_MS - (Date.now() - t0)) /
                1000
            ).toFixed(1)}s)`,
        )

        const { rows, rawOrderCount } = await fetchSalesOrderRows({
            createdAfter: chunkStart,
            createdBefore: chunkEnd,
            onProgress: (m) => opts.logs.push(`  ${m}`),
        })
        // Backfill chunks are almost always non-overlapping with existing data,
        // but if the user re-runs backfill on the same window we still need
        // idempotency — upsert handles both cases at the cost of one extra
        // sheet read per chunk.
        const { updated, appended } = await upsertOrderRows(rows)
        totalRows += rows.length
        totalOrders += rawOrderCount
        totalUpdated += updated
        totalAppended += appended
        chunksDone += 1

        // Advance cursor backwards by 1 day so we don't re-fetch the boundary day.
        cursor = addDays(chunkStart, -1)
        if (chunkStart === opts.targetStart) cursor = opts.targetStart
        await setSyncState(SYNC_CURSOR_KEY, cursor)
    }

    const done = cursor <= opts.targetStart
    return {
        mode: "backfill",
        cursor,
        target: opts.targetStart,
        done,
        chunksThisInvocation: chunksDone,
        stats: {
            orders: totalOrders,
            rows: totalRows,
            updated: totalUpdated,
            appended: totalAppended,
        },
        nextHint: done
            ? null
            : `Re-invoke (or wait for next cron tick) — cursor advanced to ${cursor}`,
    }
}

async function run(request: Request) {
    if (!(await isAuthorized(request))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const mode = (url.searchParams.get("mode") || "delta").toLowerCase()
    const logs: string[] = []
    const startedAt = Date.now()

    try {
        if (mode === "backfill") {
            const chunkDays = Number(url.searchParams.get("chunkDays")) || 14
            const targetStart = url.searchParams.get("targetStart") || "2025-01-01"
            const result = await handleBackfill({ chunkDays, targetStart, logs })
            return NextResponse.json({
                ok: true,
                ...result,
                elapsedMs: Date.now() - startedAt,
                logs,
            })
        }

        if (mode === "reset_cursor") {
            // Admin escape hatch — sets the backfill cursor to today so the
            // next backfill invocation starts from scratch.
            await setSyncState(SYNC_CURSOR_KEY, todayYmd())
            return NextResponse.json({ ok: true, cursor: todayYmd() })
        }

        if (mode === "wipe") {
            // Hard reset — clears sales_orders rows AND resets the cursor.
            await clearAllOrderRows()
            await setSyncState(SYNC_CURSOR_KEY, todayYmd())
            return NextResponse.json({
                ok: true,
                wiped: true,
                cursor: todayYmd(),
                elapsedMs: Date.now() - startedAt,
            })
        }

        if (mode === "append_only") {
            // Used by the CLI bootstrap after clearAll — straight append, no
            // existing-id read. Date window comes from query params.
            const from = url.searchParams.get("from") || "2025-01-01"
            const to = url.searchParams.get("to") || todayYmd()
            logs.push(`Append-only sync: ${from} → ${to}`)
            const { rows, rawOrderCount } = await fetchSalesOrderRows({
                createdAfter: from,
                createdBefore: to,
                onProgress: (m) => logs.push(m),
            })
            await appendOrderRows(rows)
            return NextResponse.json({
                ok: true,
                mode,
                window: { from, to },
                stats: { rawOrderCount, rows: rows.length },
                elapsedMs: Date.now() - startedAt,
                logs,
            })
        }

        // Default: delta
        const days = Number(url.searchParams.get("days")) || 3
        const result = await handleDelta({ days, logs })
        return NextResponse.json({
            ok: true,
            ...result,
            elapsedMs: Date.now() - startedAt,
            logs,
        })
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: err instanceof Error ? err.message : String(err), logs },
            { status: 500 },
        )
    }
}

export async function GET(request: Request) {
    return run(request)
}
export async function POST(request: Request) {
    return run(request)
}
