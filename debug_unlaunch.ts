
import { getSheetsClient, getSpreadsheetId } from "./src/lib/google/sheets"
import { SHEETS_CONFIG } from "./src/lib/db/schema"
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testUnlaunch() {
    console.log("Starting Unlaunch Debug Script...")

    try {
        const sheets = await getSheetsClient()
        const spreadsheetId = await getSpreadsheetId()
        const sheetName = "launched_products"

        console.log(`Spreadsheet ID: ${spreadsheetId}`)
        console.log(`Target Sheet: ${sheetName}`)

        // 1. Get Sheet ID
        const metadata = await sheets.spreadsheets.get({ spreadsheetId })
        const sheet = metadata.data.sheets?.find((s: any) => s.properties?.title === sheetName)
        const sheetId = sheet?.properties?.sheetId
        console.log(`Sheet ID: ${sheetId}`)

        if (sheetId === undefined) {
            console.error("Sheet not found!")
            return
        }

        // 2. Read Values
        const range = `${sheetName}!A:A`
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        })
        const rows = response.data.values || []
        console.log(`Found ${rows.length} rows. First 5 SKUs:`, rows.slice(0, 5).map(r => r[0]))

        // 3. Simulate Search
        const testSku = "REDIRECT-TEST-002"
        const testName = "Meari WIFI Camera N1" // Name from my previous test

        let rowIndex = rows.findIndex((row: string[]) => row[0] === testSku)
        console.log(`Searching for SKU "${testSku}"... Found at index: ${rowIndex}`)

        if (rowIndex === -1) {
            console.log("SKU not found. Trying Name Search...")
            // Column C is index 2
            rowIndex = rows.findIndex((row: string[]) => row[2] === testName)
            console.log(`Searching for Name "${testName}"... Found at index: ${rowIndex}`)
        }

        if (rowIndex !== -1) {
            console.log(`Found Row:`, rows[rowIndex])
            console.log(`Simulating deletion of row ${rowIndex + 1} (Found by ${rows[rowIndex][0] === testSku ? 'SKU' : 'Name'})...`)
            // DO NOT ACTUALLY DELETE IN TEST SCRIPT TO AVOID DATA LOSS IF LOGIC IS WRONG
            // But we confirm the index is correct relative to the API expectation (API uses 0-index for deletion, but 1-index for row numbers in UI)
            // Google Sheets API deleteDimension startIndex is inclusive, endIndex is exclusive.
            console.log(`API Request would be: startIndex: ${rowIndex}, endIndex: ${rowIndex + 1}`)
        } else {
            console.log("SKU not found. Logic check failed.")
        }

    } catch (error) {
        console.error("Error:", error)
    }
}

testUnlaunch()
