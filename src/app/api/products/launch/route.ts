import { NextResponse } from "next/server"
import { create, createMany, findAll } from "@/lib/db/adapter"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { product_id, zort_sku, product_name } = body

        if (!product_id || !zort_sku) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            )
        }

        // Check if SKU already exists
        const existing = await findAll<any>("launched_products")
        const exists = existing.find((p) => p.zort_sku === zort_sku)

        if (exists) {
            return NextResponse.json(
                { error: "SKU already launched" },
                { status: 400 }
            )
        }

        console.log("Launching Product:", { zort_sku, product_name })

        // Check again if it exists just in case
        try {
            // Add to launched_products using 'create' (single row append)
            /* await createMany("launched_products", [{
                 zort_sku,
                 launch_date: `'${new Date().toISOString().split('T')[0]}`, // Force string
                 product_name: product_name || "New Launch",
                 status: "Active",
                 launch_type: "NEW_LAUNCH"
             }])*/

            // Use create single row to test stability
            const launchDateStr = new Date().toISOString().split('T')[0]
            await create("launched_products", {
                zort_sku,
                launch_date: `'${launchDateStr}`, // Force string
                product_name: product_name || "New Launch",
                status: "Active",
                launch_type: "NEW_LAUNCH"
            })
            console.log(`Successfully created launch record for ${zort_sku} at ${launchDateStr}`)

        } catch (dbError: any) {
            console.error("DB Write Error:", dbError)
            return NextResponse.json(
                { error: "Database write failed: " + dbError.message },
                { status: 500 }
            )
        }

        console.log("Launch successful response for:", zort_sku)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Launch error:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
