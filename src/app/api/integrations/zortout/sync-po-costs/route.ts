/**
 * Sync Zortout PurchaseOrder costs into the `po_costs` Google Sheet.
 *
 * - GET / POST: triggers a sync. Authentication:
 *     • CRON_SECRET in `Authorization: Bearer <secret>` (used by Vercel Cron), OR
 *     • the request comes from a logged-in dashboard user (NextAuth session).
 *
 * Behaviour:
 *   1. Fetch all successful POs since `createdAfter` (default 2024-01-01)
 *   2. Aggregate quantity-weighted average cost per SKU
 *   3. Replace the entire `po_costs` sheet content (header + new rows)
 *   4. Return a JSON summary the UI can display next to the "Refresh" button
 */

import { NextResponse } from "next/server"
import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { SHEETS_CONFIG } from "@/lib/db/schema"
import { aggregatePoCosts } from "@/lib/zortout/po-client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function isAuthorized(request: Request): Promise<boolean> {
    // 1. Cron token (Vercel scheduler hits the route with this header).
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const header = request.headers.get("authorization") || ""
        if (header === `Bearer ${cronSecret}`) return true
    }
    // 2. NextAuth session (manual refresh from the UI).
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.email) return true
    } catch {
        /* fall through */
    }
    return false
}

async function runSync(request: Request) {
    if (!(await isAuthorized(request))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const createdAfter = url.searchParams.get("createdAfter") || "2024-01-01"

    const startedAt = Date.now()
    const logs: string[] = []

    try {
        const { summaries, rawPoCount, consideredPoCount, skippedPoCount } = await aggregatePoCosts({
            createdAfter,
            onProgress: (m) => logs.push(m),
        })

        const sheets = await getSheetsClient()
        const spreadsheetId = await getSpreadsheetId()
        const cfg = SHEETS_CONFIG.po_costs
        const syncedAt = new Date().toISOString()

        // Ensure sheet exists (create if missing) — same idempotent pattern as
        // scripts/init-new-sheets.ts so the first run on a fresh spreadsheet
        // doesn't require manual setup.
        const meta = await sheets.spreadsheets.get({ spreadsheetId })
        const existing = (meta.data.sheets ?? []).find((s) => s.properties?.title === cfg.name)
        if (!existing) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{ addSheet: { properties: { title: cfg.name } } }],
                },
            })
        }

        // Wipe and rewrite (header + all rows). Using `clear` then `update` is
        // safer than `append` here because we want a known row count.
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${cfg.name}!A:Z`,
        })

        const headerRow = Array.from(cfg.headers)
        const dataRows = summaries.map((s) => [
            s.sku,
            s.product_name,
            s.total_qty,
            s.total_value_pretax,
            s.weighted_avg_cost,
            s.latest_po_date,
            s.earliest_po_date,
            s.po_count,
            syncedAt,
        ])

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${cfg.name}!A1`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [headerRow, ...dataRows] },
        })

        return NextResponse.json({
            ok: true,
            createdAfter,
            startedAt: new Date(startedAt).toISOString(),
            syncedAt,
            elapsedMs: Date.now() - startedAt,
            stats: {
                rawPoCount,
                consideredPoCount,
                skippedPoCount,
                uniqueSkus: summaries.length,
                totalCostValue: summaries.reduce((s, r) => s + r.total_value_pretax, 0),
            },
            logs,
        })
    } catch (err) {
        return NextResponse.json(
            {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
                logs,
            },
            { status: 500 },
        )
    }
}

export async function GET(request: Request) {
    return runSync(request)
}

export async function POST(request: Request) {
    return runSync(request)
}
