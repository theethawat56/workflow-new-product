import { NextRequest, NextResponse } from "next/server"
import { create, findAll } from "@/lib/db/adapter"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { sku_code, product_name, category, sub_category, sales_channel, price } = body

        if (!sku_code || !product_name) {
            return NextResponse.json({ error: "SKU and Name are required" }, { status: 400 })
        }

        // 1. Check if SKU exists
        const products = await findAll<any>("products")
        const existing = products.find((p: any) => p.sku_code === sku_code)

        if (existing) {
            return NextResponse.json({ error: "SKU already exists" }, { status: 400 })
        }

        const productId = uuidv4()
        const now = new Date().toISOString()

        // 2. Add to Products Sheet
        await create("products", {
            product_id: productId,
            sku_code: sku_code,
            product_name: product_name,
            category: category || "Uncategorized",
            sub_category: sub_category || "",
            sales_channel: sales_channel || "Direct",
            price: price || 0,
            status: "Launched",
            created_at: now,
            updated_at: now,
            created_by: "system" // or session user email if available
        })

        // 3. Add to Launched Products Sheet
        await create("launched_products", {
            zort_sku: sku_code, // Assuming exact match for existing products
            launch_date: new Date().toISOString().split("T")[0],
            product_name: product_name,
            status: "Active",
            launch_type: "EXISTING_ADDITION"
        })

        return NextResponse.json({ success: true, product_id: productId })

    } catch (error) {
        console.error("Add Existing Product Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
