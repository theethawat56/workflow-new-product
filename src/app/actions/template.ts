"use server"

import { create, update, findAll, findOne } from "@/lib/db/adapter" // FindOne needed? findAll is enough for filtering
import { revalidatePath } from "next/cache"
import { v4 as uuidv4 } from "uuid" // Actually template_tasks identifies by template_id + task_code. Composite key.
// But we might need row index.
// My schema doesn't have a unique ID for template_tasks row other than combo.
// The `update` adapter uses a PK field. `template_tasks` doesn't have a unique single-column PK.
// Ref schema: `template_tasks`: template_id, task_code...
// I should rely on `task_code` being unique PER template.
// But `update` function in adapter takes `pkField` and `pkValue`.
// If I use `task_code` as PK, it might collide if multiple templates have T1.
// But we only have fields: template_id, task_code...
// My adapter `update` logic: `allData.findIndex((row) => row[pkField] === pkValue)`
// This ONLY works if pkField is unique globally in the sheet.
// Since `task_code` (T1) repeats for different `template_id`s, this adapter is insufficient for composite keys.

// Solution: Special update function for template tasks OR add a unique ID column to template_tasks?
// Adding `template_task_id` to schema and seeding is safest.
// Or find row by multiple criteria.

// I will Modify `adapter.ts` to support `updateByQuery` or just `updateRow`.
// Or better: Add `template_task_id` to `template_tasks` schema.
// I can just generate it or use `template_id` + `task_code` string if guaranteed unique.
// But `task_code` is user entered T1, T2.
// I'll update schema seeding to include `id` if possible, but I already seeded.
// Wait, I seeded in `init.ts` without explicit unique ID column (just template_id, task_code...).
// So the sheet doesn't have an ID column.

// Alternative: `updateTemplateTask(templateId, taskCode, data)`
// Helper function finding the row index by matching both columns.
// I'll implement `updateTemplateTaskAction` with custom finding logic.

export async function updateTemplateTaskAction(templateId: string, taskCode: string, data: any) {
    try {
        const sheets = await import("@/lib/google/sheets").then(m => m.getSheetsClient())
        const sheetId = await import("@/lib/google/sheets").then(m => m.getSpreadsheetId())
        const config = (await import("@/lib/db/schema")).SHEETS_CONFIG.template_tasks

        const readRes = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${config.name}!A:Z`
        })
        const rows = readRes.data.values || []
        // Header row = 0.
        const headers = rows[0] as string[]
        const templateIdIdx = headers.indexOf("template_id")
        const taskCodeIdx = headers.indexOf("task_code")

        // Find row index (1-based for Sheets API, counting starts at row 1)
        // Data rows start at index 1 (row 2).
        let rowIndex = -1
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][templateIdIdx] === templateId && rows[i][taskCodeIdx] === taskCode) {
                rowIndex = i
                break
            }
        }

        if (rowIndex === -1) throw new Error("Template Task not found")

        // Update specific cells or whole row?
        // We have `data` object with keys matching headers.
        // We can just update specific columns if we map them.
        // Or reconstruct row.
        const row = rows[rowIndex]
        const currentRowObj: any = {}
        headers.forEach((h, i) => currentRowObj[h] = row[i])

        const updated = { ...currentRowObj, ...data }
        const newRow = headers.map(h => updated[h] ?? "")

        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${config.name}!A${rowIndex + 1}`, // +1 because array index 0 is row 1
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [newRow] }
        })

        revalidatePath("/admin/templates")
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
