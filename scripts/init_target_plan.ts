
import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { config } from "dotenv"
import path from "path"
import { SHEETS_CONFIG } from "@/lib/db/schema"

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") })

async function initTargetPlanSheet() {
    console.log("Initializing target_plan sheet...")

    try {
        const sheets = await getSheetsClient()
        const spreadsheetId = await getSpreadsheetId()

        // 1. Check if sheet exists
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId
        })

        const sheetTitle = SHEETS_CONFIG.target_plan.name
        const existingSheet = spreadsheet.data.sheets?.find(
            s => s.properties?.title === sheetTitle
        )

        if (existingSheet) {
            console.log(`Sheet '${sheetTitle}' already exists. Checking headers...`)
            // Optional: Update headers if needed, but for now just skip creation
        } else {
            console.log(`Creating sheet '${sheetTitle}'...`)
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: {
                                    title: sheetTitle
                                }
                            }
                        }
                    ]
                }
            })
            console.log(`Sheet '${sheetTitle}' created.`)
        }

        // 2. Set Headers
        const headers = SHEETS_CONFIG.target_plan.headers
        console.log("Setting headers:", headers)

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetTitle}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [headers]
            }
        })

        console.log("Headers updated successfully.")

    } catch (error) {
        console.error("Failed to initialize target_plan sheet:", error)
    }
}

initTargetPlanSheet()
