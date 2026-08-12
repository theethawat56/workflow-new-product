/**
 * Sync Dataslot KOL_POST_SUBMISSION → Google Sheet `KOL` tab.
 * Incremental append — only rows whose taskNumber is not already in the sheet.
 */

import { format } from "date-fns"
import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { SHEETS_CONFIG } from "@/lib/db/schema"
import { fetchAllKolSubmissions, type DataslotKolHit } from "./kol-client"

const KOL = SHEETS_CONFIG.kol
const TASK_NUMBER_KEY = "taskNumber"

function postDateFromMs(ms: number | undefined): {
    iso: string
    d: string
    m: string
    y: string
} {
    if (!ms) return { iso: "", d: "", m: "", y: "" }
    const date = new Date(ms)
    return {
        iso: format(date, "yyyy-MM-dd"),
        d: String(date.getUTCDate()),
        m: String(date.getUTCMonth() + 1),
        y: String(date.getUTCFullYear()),
    }
}

/** Map one Dataslot hit to a sheet row object keyed by header name. */
export function hitToKolSheetRow(hit: DataslotKolHit): Record<string, string | number> {
    const det = hit.detail ?? {}
    const pi = det.postInfo ?? {}
    const bi = det.budgetInfo ?? {}
    const ki = det.kolInfo ?? {}
    const eng = det.engagement ?? {}
    const fps = det.featuredProducts ?? []
    const fp = fps[0] ?? {}

    const { iso, d, m, y } = postDateFromMs(pi.postDate)
    const budgetAmount = bi.budgetAmount ?? 0

    return {
        PIC: "",
        "Post Date": iso,
        D: d,
        M: m,
        Y: y,
        "Count unique": "",
        "KOL Name": ki.kolName ?? hit.ref1 ?? "",
        "Product Name": fp.name ?? hit.ref2 ?? "",
        SKU: fp.sku ?? "",
        Channel: pi.platform ?? "",
        "Budget type": bi.budgetType ?? "",
        "Budget amount": budgetAmount,
        "Budget product": "",
        "Budget Final": budgetAmount,
        "KOL Type": "",
        "Asset Link (drive)": "",
        Code: "",
        Link: pi.postUrl ?? "",
        Follower: "",
        Viewed: eng.views ?? 0,
        Saved: eng.saved ?? "",
        Liked: eng.likes ?? "",
        Shared: "",
        Status: hit.status ?? "",
        "View >1m": (eng.views ?? 0) >= 1_000_000 ? "Y" : "",
        taskNumber: hit.taskNumber ?? "",
    }
}

function rowToValues(row: Record<string, string | number>): unknown[] {
    return KOL.headers.map((h) => row[h] ?? "")
}

async function ensureKolSheet(): Promise<void> {
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()

    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const existing = (meta.data.sheets ?? []).find((s) => s.properties?.title === KOL.name)
    if (!existing) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{ addSheet: { properties: { title: KOL.name } } }],
            },
        })
    }

    const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${KOL.name}!A1:Z1`,
    })
    const currentHeader = headerRes.data.values?.[0]?.map((h) => String(h).trim()) ?? []
    if (currentHeader.length === 0) {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${KOL.name}!A1`,
            valueInputOption: "RAW",
            requestBody: { values: [Array.from(KOL.headers)] },
        })
    }
}

/** Read taskNumbers already stored in the KOL sheet. */
async function readExistingTaskNumbers(): Promise<Set<string>> {
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${KOL.name}!A:Z`,
    })

    const values = res.data.values ?? []
    if (values.length < 2) return new Set()

    const header = values[0].map((h) => String(h).trim())
    const taskIdx = header.indexOf(TASK_NUMBER_KEY)
    if (taskIdx === -1) return new Set()

    const seen = new Set<string>()
    for (const row of values.slice(1)) {
        const taskNumber = String(row[taskIdx] ?? "").trim()
        if (taskNumber) seen.add(taskNumber)
    }
    return seen
}

export interface KolSyncResult {
    ok: true
    syncedAt: string
    elapsedMs: number
    stats: {
        apiTotalHits: number
        existingSheetRows: number
        rowsAppended: number
        rowsSkippedExisting: number
        rowsSkippedNoTaskNumber: number
        skippedNoSku: number
        skippedNoDate: number
        totalSheetRows: number
        appendedByYear: Record<string, number>
    }
    logs: string[]
}

export async function syncKolToSheet(
    onProgress?: (msg: string) => void,
): Promise<KolSyncResult> {
    const startedAt = Date.now()
    const logs: string[] = []
    const log = (msg: string) => {
        logs.push(msg)
        onProgress?.(msg)
    }

    await ensureKolSheet()
    const existingTasks = await readExistingTaskNumbers()
    log(`Sheet has ${existingTasks.size} existing taskNumbers`)

    const hits = await fetchAllKolSubmissions(log)
    log(`API returned ${hits.length} records`)

    const newRows: Record<string, string | number>[] = []
    let rowsSkippedExisting = 0
    let rowsSkippedNoTaskNumber = 0
    let skippedNoSku = 0
    let skippedNoDate = 0
    const appendedByYear: Record<string, number> = {}

    for (const hit of hits) {
        const row = hitToKolSheetRow(hit)
        const taskNumber = String(row[TASK_NUMBER_KEY] ?? "").trim()

        if (!taskNumber) {
            rowsSkippedNoTaskNumber++
            continue
        }
        if (existingTasks.has(taskNumber)) {
            rowsSkippedExisting++
            continue
        }
        if (!row.SKU) {
            skippedNoSku++
            continue
        }
        if (!row["Post Date"]) {
            skippedNoDate++
            continue
        }

        const year = String(row["Post Date"]).slice(0, 4)
        appendedByYear[year] = (appendedByYear[year] ?? 0) + 1
        newRows.push(row)
        existingTasks.add(taskNumber)
    }

    log(
        `New rows to append: ${newRows.length} ` +
            `(${rowsSkippedExisting} already in sheet, ${skippedNoSku} no SKU, ` +
            `${skippedNoDate} no date, ${rowsSkippedNoTaskNumber} no taskNumber)`,
    )

    if (newRows.length > 0) {
        const sheets = await getSheetsClient()
        const spreadsheetId = await getSpreadsheetId()
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${KOL.name}!A1`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: newRows.map(rowToValues) },
        })
        log(`Appended ${newRows.length} new rows`)
    } else {
        log("No new rows to append")
    }

    const syncedAt = new Date().toISOString()
    const totalSheetRows = existingTasks.size

    return {
        ok: true,
        syncedAt,
        elapsedMs: Date.now() - startedAt,
        stats: {
            apiTotalHits: hits.length,
            existingSheetRows: totalSheetRows - newRows.length,
            rowsAppended: newRows.length,
            rowsSkippedExisting,
            rowsSkippedNoTaskNumber,
            skippedNoSku,
            skippedNoDate,
            totalSheetRows,
            appendedByYear,
        },
        logs,
    }
}
