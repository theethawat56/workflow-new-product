require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

async function inspectHeaders() {
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

        // 1. Get Metadata to list all sheets
        const meta = await client.spreadsheets.get({
            spreadsheetId
        });

        const sheets = meta.data.sheets.map(s => s.properties.title);
        console.log("ALL SHEETS:", sheets);

        // 2. Inspect headers of ALL sheets
        for (const sheetName of sheets) {
            console.log(`\n--- Inspecting '${sheetName}' ---`);
            try {
                const response = await client.spreadsheets.values.get({
                    spreadsheetId,
                    range: `${sheetName}!1:1`
                });

                const headers = response.data.values ? response.data.values[0] : [];

                const interesting = ["Key Feature", "Target Customer", "SpecSheet"];
                const found = interesting.filter(i => headers.map(h => h.toLowerCase()).includes(i.toLowerCase()));

                if (found.length > 0) {
                    console.log(`!!! MATCH FOUND IN '${sheetName}' !!!`, found);
                    console.log("Full Headers:", headers);
                } else {
                    // Check for partial matches or similar names
                    const partial = interesting.filter(i => headers.some(h => h.toLowerCase().includes(i.toLowerCase())));
                    if (partial.length > 0) {
                        console.log(`Approximate Match in '${sheetName}':`, partial);
                        console.log("Full Headers:", headers);
                    }
                }
            } catch (e) {
                console.log(`Error reading ${sheetName}:`, e.message);
            }
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

inspectHeaders();
