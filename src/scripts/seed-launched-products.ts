import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { createMany, findAll } from "../lib/db/adapter"
import { initializeDatabase } from "../lib/db/init"

const TARGET_SKUS = [
    "ATB92049", "ATB092053", "ATB092102", "ATB092103", "EU0003",
    "ATB092070", "ATB092084", "ATB011015", "EU0006", "EU0004",
    "DIB031012", "ATB092087", "ATB092086", "ATB092082", "ATB092101",
    "ATB092081", "ATB092069", "ATB092112", "ATB092068", "ATB092067",
    "ATB092106", "ATB0920667", "ATB0920668", "ATB092066", "ATB092065",
    "ATB092064", "ATB092085", "ATB092063", "ATB092061", "ATB092109",
    "ATB092110", "ATB092115", "ATB092100", "ATB092060", "ATB092055",
    "ATB092054", "ATB092104", "ATB092107", "ATB015005", "ATB014011",
    "ATB092089", "ATB092090", "ATB092111", "ATB092080", "ATB091002",
    "ATB092083", "ATB092088", "RE2032B1", "RE2025B1", "RE2016B1",
    "RE377B1", "RE10B6", "RE13B6", "RE312B6", "RE675B6",
    "PMM00036", "PMM00034", "MIDEA0003", "MIDEA0009", "PMM00035",
    "ATB092098", "ATB092094", "ATB092097", "ATB092095", "ATB092099",
    "ATB092096"
]

async function main() {
    console.log("Initializing database to create sheet if missing...")
    await initializeDatabase()

    console.log("Checking existing SKUs...")
    const existing = await findAll<any>("launched_products")
    const existingSkus = new Set(existing.map(p => p.zort_sku))

    const toAdd = TARGET_SKUS.filter(sku => !existingSkus.has(sku)).map(sku => ({
        zort_sku: sku,
        launch_date: new Date().toISOString().split('T')[0], // Default to today since we don't have past dates
        product_name: "Legacy Launch",
        status: "Active"
    }))

    if (toAdd.length === 0) {
        console.log("All SKUs already exist.")
        return
    }

    console.log(`Adding ${toAdd.length} new SKUs...`)
    await createMany("launched_products", toAdd)
    console.log("Done.")
}

main().catch(console.error)
