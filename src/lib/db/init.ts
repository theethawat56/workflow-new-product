import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { SHEETS_CONFIG, SheetName } from "./schema"
import { SEED_TEMPLATES, SEED_TEMPLATE_TASKS } from "./seed"

export async function initializeDatabase() {
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()

    const metadata = await sheets.spreadsheets.get({ spreadsheetId })
    const existingSheets = metadata.data.sheets?.map((s) => s.properties?.title) || []

    // Create missing sheets
    const requests: any[] = []

    for (const key of Object.keys(SHEETS_CONFIG) as SheetName[]) {
        const config = SHEETS_CONFIG[key]
        if (!existingSheets.includes(config.name)) {
            requests.push({
                addSheet: {
                    properties: {
                        title: config.name,
                    },
                },
            })
        }
    }

    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        })
    }

    // Set headers and Seed data (if empty)
    // We do this one by one or batch.

    for (const key of Object.keys(SHEETS_CONFIG) as SheetName[]) {
        const config = SHEETS_CONFIG[key]

        // Check if empty (read A1)
        const range = `${config.name}!A1:Z1`
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        })

        const rows = response.data.values
        if (!rows || rows.length <= 1) {
            // Empty sheet or only headers.
            // If completely empty, set headers first
            if (!rows || rows.length === 0) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${config.name}!A1`,
                    valueInputOption: "RAW",
                    requestBody: {
                        values: [config.headers as unknown as string[]]
                    }
                })
            }

            // Seed Tables (Only if empty/just headers to avoid dupes)
            // Note: If headers existed, we just append data.
            if (key === 'task_templates') {
                const values = SEED_TEMPLATES.map(t => [t.template_id, t.template_name, t.active])
                await sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: `${config.name}!A2`,
                    valueInputOption: "RAW",
                    requestBody: { values }
                })
            }

            if (key === 'template_tasks') {
                const values = SEED_TEMPLATE_TASKS.map(t => [
                    t.template_id,
                    t.task_code,
                    t.task_name,
                    t.phase,
                    t.default_owner_role,
                    t.offset_days,
                    t.duration_days,
                    t.depends_on,
                    t.required_fields,
                    t.input_type
                ])
                await sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: `${config.name}!A2`,
                    valueInputOption: "RAW",
                    requestBody: { values }
                })
            }
        } else {
            // Sheet exists. Check if headers match. If not, update headers.
            const currentHeaders = rows[0]
            const configHeaders = config.headers

            // Simple check: if length differs or last element differs
            if (JSON.stringify(currentHeaders) !== JSON.stringify(configHeaders)) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${config.name}!A1`,
                    valueInputOption: "RAW",
                    requestBody: {
                        values: [config.headers as unknown as string[]]
                    }
                })
            }
        }
    }

    return { success: true, message: "Database initialized successfully" }
}
