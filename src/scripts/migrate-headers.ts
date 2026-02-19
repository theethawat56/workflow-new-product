import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '.env.local') });

import { getSheetsClient, getSpreadsheetId } from '../lib/google/sheets';
import { SHEETS_CONFIG } from '../lib/db/schema';

async function migrate() {
    try {
        console.log("Starting Schema Migration...");
        const sheets = await getSheetsClient();
        const spreadsheetId = await getSpreadsheetId();

        // Check products sheet
        const sheetConfig = SHEETS_CONFIG.products;
        const realSheetName = sheetConfig.name;

        console.log(`Checking sheet: ${realSheetName}`);

        // Read current headers (Row 1)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${realSheetName}!1:1`, // Read first row
        });

        const currentHeaders = response.data.values?.[0] || [];
        console.log("Current headers:", currentHeaders);

        const expectedHeaders = sheetConfig.headers;
        const missingHeaders = expectedHeaders.filter(h => !currentHeaders.includes(h));

        if (missingHeaders.length === 0) {
            console.log("All headers present. No migration needed.");
            return;
        }

        console.log("Missing headers:", missingHeaders);

        // Determine where to append
        // Sheets are 1-indexed. currentHeaders.length is the count of filled columns.
        // We start appending at Column (currentHeaders.length + 1)

        // Helper to convert number to column letter (A, B, ... Z, AA...)
        // But we don't need it if we append?
        // Actually, 'values.append' on range '1:1' might append to bottom? No.
        // We should use 'values.update' on the specific range or 'values.append' with 'insertDataOption'.
        // Easier: Just update the entire header row with the merged list?
        // But we want to preserve order of existing data if any? 
        // Best approach: Add new headers at the end of the existing row.

        // Let's just update the 1:1 range with the FULL expected header list?
        // NO. If we change order, we break data mapping if we don't move data columns.
        // The safest is to Append NEW headers to the end.

        // But `SHEETS_CONFIG` has a specific order. The adapter map writes based on `SHEETS_CONFIG` order.
        // If `SHEETS_CONFIG` order changed (e.g. inserted in middle), checking just existence is not enough.
        // However, I appended `fair_detail` and `date_of_fair` to the END of the list in `schema.ts`.
        // So they should be at the end.

        const nextColumnIndex = currentHeaders.length;
        const startColumnLetter = getColumnLetter(nextColumnIndex); // 0-based index to A1 notation

        console.log(`Appending missing headers starting at ${startColumnLetter}1`);

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${realSheetName}!${startColumnLetter}1`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [missingHeaders]
            }
        });

        console.log("Migration completed successfully.");

    } catch (error) {
        console.error("Migration failed:", error);
    }
}

function getColumnLetter(colIndex: number): string {
    let temp, letter = '';
    while (colIndex >= 0) {
        temp = (colIndex) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = Math.floor((colIndex) / 26) - 1;
    }
    return letter;
}

migrate();
