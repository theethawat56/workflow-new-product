
import { findAll } from "@/lib/db/adapter"
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

async function debugProduct() {
    console.log("Fetching data checking for QA-SKU-001...")

    try {
        const products = await findAll("products")
        const launched = await findAll("launched_products")

        const product = products.find((p: any) => p.sku_code === "QA-SKU-002")
        const launchInfo = launched.find((l: any) => l.zort_sku === "QA-SKU-002")

        console.log("--- Product Sheet Data ---")
        console.log(product || "Product NOT FOUND in products sheet")

        console.log("\n--- Launched Products Sheet Data ---")
        console.log(launchInfo || "Product NOT FOUND in launched_products sheet")

    } catch (error) {
        console.error("Error:", error)
    }
}

debugProduct()
