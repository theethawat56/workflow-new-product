
import { getSheetsClient, getSpreadsheetId } from "./src/lib/google/sheets"
import { SHEETS_CONFIG } from "./src/lib/db/schema"
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function deleteStuckRow() {
    console.log("Deleting stuck row 49...")

    try {
        const sheets = await getSheetsClient()
        const spreadsheetId = await getSpreadsheetId()

        // Hardcoded deletion of row 49 (which is index 48)
        const rowIndex = 48

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: 81299844, // Derived from debug output
                                dimension: "ROWS",
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1
                            }
                        }
                    }
                ]
            }
        })
        console.log("Successfully deleted row 49.")

    } catch (error) {
        console.error("Error:", error)
    }
}

deleteStuckRow()
