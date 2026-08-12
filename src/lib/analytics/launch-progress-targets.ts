/**
 * Per-group progress bar target overrides for Launch Command Center.
 * Stored in Google Sheet `launch_progress_targets`.
 */

import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { ensureSheetWithHeaders } from "@/lib/sales/order-sheet-writer"

export const LAUNCH_PROGRESS_TARGETS_CONFIG = {
    name: "launch_progress_targets",
    headers: ["group_id", "label", "progress_goal", "updated_by", "updated_at"] as const,
}

export type LaunchProgressTargetRow = {
    group_id: string
    label: string
    progress_goal: number
    updated_by: string
    updated_at: string
}

function rowToValues(row: LaunchProgressTargetRow): unknown[] {
    return LAUNCH_PROGRESS_TARGETS_CONFIG.headers.map((h) => {
        if (h === "group_id") return row.group_id
        if (h === "label") return row.label
        if (h === "progress_goal") return row.progress_goal
        if (h === "updated_by") return row.updated_by
        if (h === "updated_at") return row.updated_at
        return ""
    })
}

export async function ensureLaunchProgressTargetsSheet(): Promise<void> {
    await ensureSheetWithHeaders(
        LAUNCH_PROGRESS_TARGETS_CONFIG.name,
        LAUNCH_PROGRESS_TARGETS_CONFIG.headers,
    )
}

/**
 * Read custom progress goals keyed by group_id.
 * Reads directly without ensuring the sheet exists (saves 2 API calls per
 * page load); a missing tab throws and the caller treats it as "no overrides".
 * The tab is created on first save via upsertProgressGoalOverride.
 */
export async function loadProgressGoalOverrides(): Promise<Map<string, number>> {
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${LAUNCH_PROGRESS_TARGETS_CONFIG.name}!A:E`,
    })

    const values = res.data.values ?? []
    if (values.length < 2) return new Map()

    const header = values[0].map((h) => String(h).trim())
    const groupIdx = header.indexOf("group_id")
    const goalIdx = header.indexOf("progress_goal")
    if (groupIdx === -1 || goalIdx === -1) return new Map()

    const map = new Map<string, number>()
    for (const row of values.slice(1)) {
        const groupId = String(row[groupIdx] ?? "").trim().toUpperCase()
        const goal = Number(String(row[goalIdx] ?? "").replace(/,/g, ""))
        if (groupId && Number.isFinite(goal) && goal > 0) {
            map.set(groupId, goal)
        }
    }
    return map
}

export async function upsertProgressGoalOverride(input: {
    groupId: string
    label?: string
    progressGoal: number
    updatedBy: string
}): Promise<LaunchProgressTargetRow> {
    await ensureLaunchProgressTargetsSheet()
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()

    const existingRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${LAUNCH_PROGRESS_TARGETS_CONFIG.name}!A2:E`,
    })

    const existingRows = (existingRes.data.values as string[][]) ?? []
    const groupKey = input.groupId.trim().toUpperCase()
    const existingIndex = existingRows.findIndex(
        (row) => String(row[0] ?? "").trim().toUpperCase() === groupKey,
    )

    const now = new Date().toISOString()
    const row: LaunchProgressTargetRow = {
        group_id: groupKey,
        label: input.label ?? "",
        progress_goal: input.progressGoal,
        updated_by: input.updatedBy,
        updated_at: now,
    }

    if (existingIndex >= 0) {
        const sheetRow = existingIndex + 2
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${LAUNCH_PROGRESS_TARGETS_CONFIG.name}!A${sheetRow}:E${sheetRow}`,
            valueInputOption: "RAW",
            requestBody: { values: [rowToValues(row)] },
        })
    } else {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${LAUNCH_PROGRESS_TARGETS_CONFIG.name}!A1`,
            valueInputOption: "RAW",
            requestBody: { values: [rowToValues(row)] },
        })
    }

    return row
}

export async function deleteProgressGoalOverride(groupId: string): Promise<void> {
    await ensureLaunchProgressTargetsSheet()
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()

    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const sheet = (meta.data.sheets ?? []).find(
        (s) => s.properties?.title === LAUNCH_PROGRESS_TARGETS_CONFIG.name,
    )
    if (!sheet?.properties?.sheetId) return

    const existingRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${LAUNCH_PROGRESS_TARGETS_CONFIG.name}!A2:A`,
    })
    const existingRows = (existingRes.data.values as string[][]) ?? []
    const groupKey = groupId.trim().toUpperCase()
    const existingIndex = existingRows.findIndex(
        (row) => String(row[0] ?? "").trim().toUpperCase() === groupKey,
    )
    if (existingIndex < 0) return

    const sheetRow = existingIndex + 1 // 0-based data row index in sheet (row 2 = index 0)
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [
                {
                    deleteDimension: {
                        range: {
                            sheetId: sheet.properties.sheetId,
                            dimension: "ROWS",
                            startIndex: sheetRow,
                            endIndex: sheetRow + 1,
                        },
                    },
                },
            ],
        },
    })
}
