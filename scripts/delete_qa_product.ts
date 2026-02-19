
import { deleteRow, findAll } from "@/lib/db/adapter"
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

async function deleteQAProduct() {
    console.log("Deleting QA-SKU-002...")

    try {
        // 1. Find product_id
        const products = await findAll("products")
        const product = products.find((p: any) => p.sku_code === "QA-SKU-002")

        if (product) {
            console.log("Found product:", product.product_id)
            await deleteRow("products", "product_id", product.product_id)
            console.log("Deleted from products sheet")
        } else {
            console.log("Product not found in products sheet")
        }

        // 2. Find launched record (if any)
        const launched = await findAll("launched_products")
        const launchInfo = launched.find((l: any) => l.zort_sku === "QA-SKU-002")

        if (launchInfo) {
            await deleteRow("launched_products", "zort_sku", "QA-SKU-002")
            console.log("Deleted from launched_products sheet")
        } else {
            console.log("Product not found in launched_products sheet")
        }

    } catch (error) {
        console.error("Error deleting:", error)
    }
}

deleteQAProduct()
