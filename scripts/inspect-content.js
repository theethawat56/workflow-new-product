require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

async function inspectContent() {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const client = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

        if (!spreadsheetId) {
            console.error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
            return;
        }

        const sheetName = "product_tasks";
        console.log(`\n--- Inspecting contents of '${sheetName}' ---`);

        const response = await client.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:Z`
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log("No data found.");
            return;
        }

        const headers = rows[0];
        console.log("Headers:", headers);

        // Indices
        const taskNameIdx = headers.indexOf("task_name");
        const notesIdx = headers.indexOf("notes");
        const productIdIdx = headers.indexOf("product_id");

        console.log("\nSearching for keywords: Key Feature, Target Customer, SpecSheet...");

        let foundCount = 0;
        rows.slice(1).forEach((row, i) => {
            const name = row[taskNameIdx];
            const notes = row[notesIdx];
            const pid = row[productIdIdx];

            const taskStr = (name || "").toLowerCase();
            if (taskStr.includes("key feature") ||
                taskStr.includes("target customer") ||
                taskStr.includes("specsheet") ||
                taskStr.includes("spec sheet")) {

                console.log(`\n[Row ${i + 2}] Product: ${pid} | Task: ${name}`);
                console.log(`Notes: ${notes ? notes.substring(0, 100) + "..." : "(empty)"}`);
                foundCount++;
            }
        });

        if (foundCount === 0) {
            console.log("No matching tasks found. Dumping first 10 tasks to verify structure:");
            rows.slice(1, 11).forEach(row => {
                console.log(`- ${row[taskNameIdx]} (Notes: ${row[notesIdx]})`);
            });
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

inspectContent();
