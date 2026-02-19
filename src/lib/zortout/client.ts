import { ZortoutOrder, ZortoutGenericResponse } from "./types"

const ZORTOUT_API_URL = "https://open-api.zortout.com/v4/Order/GetOrders"
const STORENAME = "narong1.autobot@gmail.com"
const APIKEY = "wt2nFpHIUZrrm9VdOCLPGlJCNkLCQRZCtWy4aaA="
const APISECRET = "kQYH9bb2S4FhqXuNGRvICjfA4w4mR2aKycINNc8mgWY="

export async function fetchZortoutOrders(page: number = 1, limit: number = 200, createdAfter?: string, createdBefore?: string): Promise<ZortoutOrder[]> {
    try {
        const url = new URL(ZORTOUT_API_URL)
        url.searchParams.append("page", page.toString())
        url.searchParams.append("limit", limit.toString())
        if (createdAfter) url.searchParams.append("createdafter", createdAfter)
        if (createdBefore) url.searchParams.append("createdbefore", createdBefore)

        const headers = {
            "storename": STORENAME,
            "apikey": APIKEY,
            "apisecret": APISECRET,
            "Content-Type": "application/json"
        }

        const res = await fetch(url.toString(), { headers, method: "GET" })
        if (!res.ok) {
            throw new Error(`Zortout API error: ${res.status} ${res.statusText}`)
        }

        const data: ZortoutGenericResponse<ZortoutOrder> = await res.json()
        return data.list || []
    } catch (error) {
        console.error("Failed to fetch Zortout orders:", error)
        return []
    }
}

// Helper to flatten orders into line items for our DB
export interface SaleOrderItem {
    order_id: string
    order_number: string
    order_date: string
    sales_channel: string
    sku: string
    product_name: string
    market_place_name: string
    quantity: number
    price_per_unit: number
    total_amount: number
    customer_name: string
    status: string
    payment_status: string
}

export interface SaleAllItem {
    Date: string
    SKU: string
    "Product Name": string
    "Units Sold": number
    Revenue: number
    "Avg Selling Price": number
}

export function transformToSaleOrderItems(orders: ZortoutOrder[]): SaleOrderItem[] {
    const items: SaleOrderItem[] = []

    orders.forEach(order => {
        // Skip Voided/Cancelled if desired? User didn't specify, but usually we exclude them for "sales".
        // The user's example includes "Voided".
        // Dashboard usually shows GROSS or NET. I will include everything and let the dashboard filter by status if needed.

        order.list.forEach(item => {
            items.push({
                order_id: order.id.toString(),
                order_number: order.number,
                order_date: order.orderdate, // Keep ISO string
                sales_channel: order.saleschannel || "Unknown",
                sku: item.sku,
                product_name: item.name,
                market_place_name: order.saleschannel || "", // Sometimes separate, but use saleschannel for now
                quantity: item.number,
                price_per_unit: item.pricepernumber,
                total_amount: item.totalprice,
                customer_name: order.customername,
                status: order.status,
                payment_status: order.paymentstatus
            })
        })
    })

    return items
}

export function transformToSaleAllItems(orders: ZortoutOrder[]): SaleAllItem[] {
    const items: SaleAllItem[] = []

    orders.forEach(order => {
        // Assuming we want to exclude Voided/Cancelled for the main "Sale_All" report which drives revenue?
        // Plan said "status will be assumed as Completed", so better to filter out invalid ones here or include all?
        // Zortout sends everything. Let's include everything for now to match raw data, but maybe filter in dashboard.
        // Actually, Sale_All schema doesn't have status, so if we include Voided, we can't filter them out later!
        // CRITICAL DECSION: Exclude Voided/Cancelled from Sale_All since we can't filter them later.
        if (order.status === 'Voided' || order.status === 'Cancelled') return;

        // Date formatting: Zortout is ISO (2023-10-27T00:00:00). Sale_All expects "Date" (format depends on sheet, usually YYYY-MM-DD or DD/MM/YYYY).
        // I'll use YYYY-MM-DD for consistency.
        const dateStr = order.orderdate.split('T')[0]

        order.list.forEach(item => {
            items.push({
                Date: dateStr,
                SKU: item.sku,
                "Product Name": item.name,
                "Units Sold": item.number,
                Revenue: item.totalprice,
                "Avg Selling Price": item.pricepernumber
            })
        })
    })

    return items
}
