
import { findAll } from "@/lib/db/adapter"
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(process.cwd(), ".env.local") })

async function check() {
    try {
        const products = await findAll<any>("launched_products")
        console.log(`Total products: ${products.length}`)

        const withLaunchType = products.filter(p => p.launch_type).length
        console.log(`Products with launch_type: ${withLaunchType}`)

        const existingAdds = products.filter(p => p.launch_type === 'EXISTING_ADDITION').length
        console.log(`Existing Additions: ${existingAdds}`)

        const newLaunches = products.filter(p => p.launch_type === 'NEW_LAUNCH').length
        console.log(`New Launches: ${newLaunches}`)

        if (products.length > 0) {
            console.log("Sample product:", products[0])
        }

    } catch (error) {
        console.error("Check failed:", error)
    }
}

check()
