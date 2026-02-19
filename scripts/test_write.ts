
import { createMany, findAll } from "@/lib/db/adapter"
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

async function testWrite() {
    console.log("Testing write to launched_products...")

    try {
        const testSku = "TEST-WRITE-" + Date.now()

        console.log("Appending:", testSku)
        await createMany("launched_products", [{
            zort_sku: testSku,
            launch_date: "2026-02-08",
            product_name: "Test Write",
            status: "Active",
            launch_type: "NEW_LAUNCH"
        }])

        console.log("Write complete. Verification reading...")

        const rows = await findAll("launched_products")
        const found = rows.find((r: any) => r.zort_sku === testSku)

        if (found) {
            console.log("SUCCESS: Found written row:", found)
        } else {
            console.log("FAILURE: Row not found after write!")
            console.log("Total rows:", rows.length)
        }

    } catch (error) {
        console.error("Error:", error)
    }
}

testWrite()
