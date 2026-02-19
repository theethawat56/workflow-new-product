
import { createMany } from "@/lib/db/adapter"
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

async function manualAdd() {
    console.log("Manually adding QA-SKU-002 to launched_products...")

    try {
        await createMany("launched_products", [{
            zort_sku: "QA-SKU-002",
            launch_date: "2026-02-08",
            product_name: "Test QA Product v2",
            status: "Active",
            launch_type: "NEW_LAUNCH"
        }])

        console.log("Manual add complete.")

    } catch (error) {
        console.error("Error:", error)
    }
}

manualAdd()
