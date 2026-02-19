
import { create, deleteRow, findAll } from "@/lib/db/adapter"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { v4 as uuidv4 } from "uuid"

async function run() {
    console.log("Starting reproduction with direct adapter calls...")

    // 1. Create a dummy product
    const productId = `TEST-${uuidv4().substring(0, 8)}`
    const productData = {
        product_id: productId,
        sku_code: "TEST-DELETE-REPRO",
        product_name: "Delete Repro Product",
        category: "Home Appliances",
        status: "Draft",
        created_at: new Date().toISOString()
    }

    console.log(`Creating product ${productId}...`)
    try {
        await create("products", productData)
        console.log("Created successfully.")
    } catch (e: any) {
        console.error("Create failed:", e.message)
        return
    }

    // 2. Verify it exists
    const productsAfterCreate = await findAll<any>("products")
    const found = productsAfterCreate.find(p => p.product_id === productId)
    if (!found) {
        console.error("Product not found after creation!")
        return
    }
    console.log("Verified product exists in sheet.")

    // 3. Try to delete it
    console.log("Deleting product...")
    try {
        await deleteRow("products", "product_id", productId)
        console.log("Delete action returned (no error thrown).")
    } catch (e: any) {
        console.error("Delete failed with error:", e.message)
    }

    // 4. Verify it is gone
    const productsAfterDelete = await findAll<any>("products")
    const foundAfter = productsAfterDelete.find(p => p.product_id === productId)

    if (foundAfter) {
        console.error("FAIL: Product still exists after delete!")
    } else {
        console.log("SUCCESS: Product was deleted.")
    }
}

run().catch(console.error)
