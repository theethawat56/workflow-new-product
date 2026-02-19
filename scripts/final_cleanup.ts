
import { deleteRow, findAll } from "@/lib/db/adapter"
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

async function finalCleanup() {
    console.log("Starting Final Cleanup...")

    try {
        // 1. Delete Product QA-SKU-003 from 'products'
        const products = await findAll("products")
        const product = products.find((p: any) => p.sku_code === "QA-SKU-003")

        if (product) {
            console.log("Found product:", product.product_id)
            await deleteRow("products", "product_id", product.product_id)
            console.log("Deleted QA-SKU-003 from products sheet")
        } else {
            console.log("QA-SKU-003 not found in products sheet")
        }

        // 2. Delete Launch Record QA-SKU-003-V3 from 'launched_products'
        const launched = await findAll("launched_products")
        const launchInfo = launched.find((l: any) => l.zort_sku === "QA-SKU-003-V3")

        if (launchInfo) {
            await deleteRow("launched_products", "zort_sku", "QA-SKU-003-V3")
            console.log("Deleted QA-SKU-003-V3 from launched_products sheet")
        } else {
            console.log("QA-SKU-003-V3 not found in launched_products sheet")
        }

    } catch (error) {
        console.error("Error deleting:", error)
    }
}

finalCleanup()
