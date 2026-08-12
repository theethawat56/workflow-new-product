/**
 * CLI: incremental sync Dataslot KOL data → Google Sheet `KOL` tab.
 * Appends only rows whose taskNumber is not already in the sheet.
 * Usage: npx tsx scripts/sync-kol-from-dataslot.ts
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { syncKolToSheet } from "../src/lib/dataslot/kol-sync"

async function main() {
    console.log("Starting Dataslot KOL → Google Sheet sync...")
    const result = await syncKolToSheet((msg) => console.log(`  ${msg}`))
    console.log("\nDone:")
    console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
    console.error("Sync failed:", err)
    process.exit(1)
})
