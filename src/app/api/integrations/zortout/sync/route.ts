import { NextResponse } from "next/server"
import { fetchZortoutOrders, transformToSaleAllItems, SaleAllItem } from "@/lib/zortout/client"
import { findAll, createMany } from "@/lib/db/adapter"
import { SheetName } from "@/lib/db/schema"

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const range = searchParams.get('range') // 'today' or default (3 months)

        // 1. Fetch from Zortout
        const now = new Date()
        let createdAfter: string

        if (range === 'today') {
            createdAfter = now.toISOString().split('T')[0]
            console.log(`Sync Range: TODAY (${createdAfter})`)
        } else {
            const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3))
            createdAfter = threeMonthsAgo.toISOString().split('T')[0]
            console.log(`Sync Range: 3 MONTHS (${createdAfter})`)
        }

        const createdBefore = new Date().toISOString().split('T')[0] // Today

        let allNewOrders: any[] = []
        let page = 1
        const SAFETY_LIMIT = 50 // Max 10,000 orders (200 * 50) to prevent infinite loops

        while (page <= SAFETY_LIMIT) {
            console.log(`Fetching Zortout page ${page}...`)
            const orders = await fetchZortoutOrders(page, 200, createdAfter, createdBefore)

            if (orders.length === 0) {
                console.log("No more orders found.")
                break
            }

            allNewOrders.push(...orders)
            page++

            // Optional: Add small delay to avoid rate limits? 
            // await new Promise(r => setTimeout(r, 200))
        }

        const newItems = transformToSaleAllItems(allNewOrders)

        // 2. Fetch existing to avoid duplicates
        // Sale_All doesn't have a unique ID. We use a composite key: Date + SKU + Revenue + Units
        // This isn't perfect (two identical sales on same day), but best we can do without an ID.
        const existingData = await findAll<any>("sales_all" as SheetName)

        const existingSet = new Set(existingData.map(item =>
            `${item.Date}|${item.SKU}|${item.Revenue}|${item["Units Sold"]}`
        ))

        // 3. Filter duplicates
        const itemsToAdd = newItems.filter(item => {
            const key = `${item.Date}|${item.SKU}|${item.Revenue}|${item["Units Sold"]}`
            return !existingSet.has(key)
        })

        // 4. Save to DB
        if (itemsToAdd.length > 0) {
            await createMany("sales_all" as SheetName, itemsToAdd)
        }

        return NextResponse.json({
            success: true,
            fetched: newItems.length,
            added: itemsToAdd.length,
            message: `Successfully synced ${itemsToAdd.length} new items.`
        })

    } catch (error: any) {
        console.error("Sync error:", error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
