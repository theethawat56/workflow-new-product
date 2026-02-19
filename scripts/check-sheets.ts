
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { fetchSheet } from "../src/lib/workspace/data-source"
import { SHEETS_CONFIG } from "../src/lib/db/schema"

// Monkey patch SHEETS_CONFIG to try other names dynamically? 
// No, fetchSheet uses SHEETS_CONFIG keys to look up the config. 
// I need to try keys that exists in schema, but I can't easily add keys to schema at runtime without modifying the file.
// However, the `fetchSheet` function takes `SheetName` which is `keyof typeof SHEETS_CONFIG`.
// But I can cast string to any to bypass TS for the script.

// But `fetchSheet` logic: `const config = SHEETS_CONFIG[sheetName]`.
// So I can't just pass any string.

// I will try to modify schema.ts momentarily OR I can just use the underlying google sheets client if I can.
// But `fetchSheet` encapsulates the client.

// Let's modify `src/lib/db/schema.ts` to add temporary test entries? No, that triggers rebuilds and is messy.

// I will verify "Sale_All" (singular) because the user mentioned it.
// I'll assume the schema in `src/lib/db/schema.ts` allows me to change the *value* of the name property.
// But `SHEETS_CONFIG` is const.

// Wait, the error `Unable to parse range: Sales_All!A:Z` comes from the Google API.
// It uses `config.name` for the range.
// So if I want to test "Sale_All", I must change `SHEETS_CONFIG.sales_all.name` in `schema.ts`.

// Let's try to infer from the user's prompt first. User said "Sale_All".
// I'll update schema.ts to use "Sale_All" for the `sales_all` key.
// And for KOL, I'll remove "Asset Link" from headers in schema.ts.

async function check() {
    console.log("Checking KOL...")
    try {
        const kol = await fetchSheet("kol")
        console.log(`Success KOL: ${kol.length} rows`)
    } catch (e: any) {
        console.log("KOL Error:", e.message)
    }

    console.log("Checking Sales_All...")
    try {
        const sales = await fetchSheet("sales_all")
        console.log(`Success Sales: ${sales.length} rows`)
    } catch (e: any) {
        console.log("Sales Error:", e.message)
    }
}

check()
