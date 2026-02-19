require('dotenv').config({ path: '.env.local' });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function inspectTasks() {
    // Initialize Auth
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['product_tasks']; // Try 'product_tasks'
    if (!sheet) {
        console.log("Sheet 'product_tasks' not found.");
        return;
    }

    const rows = await sheet.getRows();

    // Look for SKU 'ATB092116' or just print first few
    console.log(`Found ${rows.length} rows in product_tasks.`);

    // Check headers
    console.log("Headers:", sheet.headerValues);

    // Print first 3 rows to see structure
    rows.slice(0, 3).forEach((row, i) => {
        console.log(`\n--- Row ${i} ---`);
        sheet.headerValues.forEach(h => {
            console.log(`${h}: ${row.get(h)}`);
        });
    });
}

inspectTasks();
