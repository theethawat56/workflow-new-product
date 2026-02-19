import { getReadOnlySheetsClient } from "../src/lib/google/sheets-readonly"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

async function inspectHeaders() {
    try {
        const client = await getReadOnlySheetsClient()
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

        if (!spreadsheetId) {
            console.error("Missing GOOGLE_SHEETS_SPREADSHEET_ID")
            return
        }

        const sheetsToCheck = ["products", "product_tasks"]

        for (const sheetName of sheetsToCheck) {
            console.log(`\n--- Inspecting '${sheetName}' ---`)
            const response = await client.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!1:1` // Get first row only
            })

            const headers = response.data.values?.[0] || []
            console.log("Headers found:", headers)

            // Check if user request columns exist
            const interesting = ["Key Feature", "Target Customer", "SpecSheet"]
            const found = interesting.filter(i => headers.map(h => h.toLowerCase()).includes(i.toLowerCase()))
            console.log("Found requested columns:", found)
        }

    } catch (e) {
        console.error("Error:", e)
    }
}

inspectHeaders()
