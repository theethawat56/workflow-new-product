
import { findAll, update } from "@/lib/db/adapter"
import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { config } from "dotenv"
import path from "path"

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") })

const EXISTING_SKUS = [
    "ATB92049", "ATB011015", "ATB014011", "ATB015005", "ATB091002",
    "ATB092054", "ATB092055", "ATB092058", "ATB092060", "ATB092061",
    "ATB092063", "ATB092064", "ATB092065", "ATB092066", "ATB0920667",
    "ATB0920668", "ATB092067", "ATB092068", "ATB092069", "ATB092070",
    "ATB092080", "ATB092081", "ATB092082", "ATB092083", "ATB092084",
    "ATB092085", "ATB092086", "ATB092087", "ATB092088", "ATB092089",
    "ATB092090", "ATB092100", "ATB092101", "ATB092102", "ATB092103",
    "ATB092104", "ATB092106", "ATB092107", "ATB092109", "ATB092110",
    "ATB092111", "ATB092112", "EU0003", "EU0006"
]

// ATB092105 is explicitly NEW per user request

async function updateHeaders() {
    console.log("Updating headers...")
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()

    // launched_products is likely Sheet3 or similar, but we refer by name in range
    // Headers: zort_sku, launch_date, product_name, status, launch_type
    const headers = ["zort_sku", "launch_date", "product_name", "status", "launch_type"]

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "launched_products!A1:E1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
            values: [headers]
        }
    })
    console.log("Headers updated.")
}

async function migrate() {
    console.log("Starting migration...")

    try {
        await updateHeaders() // Ensure headers are correct first

        const products = await findAll<any>("launched_products")
        console.log(`Found ${products.length} launched products to migrate.`)

        let updatedCount = 0

        for (const product of products) {
            const isExisting = EXISTING_SKUS.includes(product.zort_sku)
            const newLaunchType = isExisting ? "EXISTING_ADDITION" : "NEW_LAUNCH"

            // Only update if changed or empty
            if (product.launch_type !== newLaunchType) {
                console.log(`Updating ${product.zort_sku} to ${newLaunchType}`)
                await update("launched_products", "zort_sku", product.zort_sku, {
                    launch_type: newLaunchType
                })
                updatedCount++
            }
        }

        console.log(`Migration complete. Updated ${updatedCount} rows.`)

    } catch (error) {
        console.error("Migration failed:", error)
    }
}

migrate()
