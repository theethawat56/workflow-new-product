
import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

async function checkHeaders() {
    console.log("Checking headers for launched_products...")

    try {
        const sheets = await getSheetsClient()
        const spreadsheetId = await getSpreadsheetId()

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "launched_products!A1:Z5", // Read first 5 rows
        })

        const rows = response.data.values
        if (!rows || rows.length === 0) {
            console.log("No data found!")
            return
        }

        console.log("Headers (Row 1):", rows[0])
        console.log("Row 2:", rows[1] || "Empty")
        console.log("Row 3:", rows[2] || "Empty")
        console.log("Total Rows Read:", rows.length)

    } catch (error) {
        console.error("Error:", error)
    }
}

checkHeaders()
