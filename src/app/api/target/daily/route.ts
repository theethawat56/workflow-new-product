import { NextResponse } from "next/server"
import { fetchSheet } from "@/lib/workspace/data-source"
import { buildSkuProductNameMap, resolveProductName } from "@/lib/target/product-names"
import { z } from "zod"

const SalesOrderRowSchema = z.object({
    order_date: z.string(),
    status: z.string(),
    sku: z.string(),
    product_name: z.string().optional().default(""),
    line_total: z.coerce.number(),
})

const DailyResponseSchema = z.object({
    gainers: z
        .array(
            z.object({
                sku: z.string(),
                productName: z.string(),
                delta: z.number(),
                currentRevenue: z.number(),
                previousRevenue: z.number(),
            }),
        )
        .max(7),
    losers: z
        .array(
            z.object({
                sku: z.string(),
                productName: z.string(),
                delta: z.number(),
                currentRevenue: z.number(),
                previousRevenue: z.number(),
            }),
        )
        .max(7),
})

export type DailyResponse = z.infer<typeof DailyResponseSchema>

function parseDate(dateStr: string): Date | null {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
}

function formatDate(date: Date): string {
    return date.toISOString().split("T")[0]
}

function isATBorEUProduct(sku: string): boolean {
    const s = sku.trim().toUpperCase()
    return s.startsWith("ATB") || s.startsWith("EU") || s.startsWith("E00")
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const date = searchParams.get("date")

        if (!date) {
            return NextResponse.json(
                { error: "Date parameter is required" },
                { status: 400 },
            )
        }

        const targetDate = parseDate(date)
        if (!targetDate) {
            return NextResponse.json(
                { error: "Invalid date format" },
                { status: 400 },
            )
        }

        const prevYearDate = new Date(
            targetDate.getFullYear() - 1,
            targetDate.getMonth(),
            targetDate.getDate(),
        )

        const [rawSalesData, nameMap] = await Promise.all([
            fetchSheet("sales_orders"),
            buildSkuProductNameMap(),
        ])

        const salesData = rawSalesData
            .map((row) => {
                try {
                    return SalesOrderRowSchema.parse(row)
                } catch {
                    return null
                }
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
            .filter(
                (row) =>
                    row.status === "Success" && isATBorEUProduct(row.sku),
            )

        const currentDayData = salesData.filter((row) => {
            const orderDate = parseDate(row.order_date)
            return orderDate && formatDate(orderDate) === formatDate(targetDate)
        })

        const prevYearDayData = salesData.filter((row) => {
            const orderDate = parseDate(row.order_date)
            return (
                orderDate && formatDate(orderDate) === formatDate(prevYearDate)
            )
        })

        const currentRevenueBySku = new Map<string, number>()
        const prevRevenueBySku = new Map<string, number>()

        currentDayData.forEach((row) => {
            const sku = row.sku.trim()
            currentRevenueBySku.set(
                sku,
                (currentRevenueBySku.get(sku) || 0) + row.line_total,
            )
            if (row.product_name?.trim() && !nameMap.has(sku)) {
                nameMap.set(sku, row.product_name.trim())
            }
        })

        prevYearDayData.forEach((row) => {
            const sku = row.sku.trim()
            prevRevenueBySku.set(
                sku,
                (prevRevenueBySku.get(sku) || 0) + row.line_total,
            )
            if (row.product_name?.trim() && !nameMap.has(sku)) {
                nameMap.set(sku, row.product_name.trim())
            }
        })

        const deltas: Array<{
            sku: string
            delta: number
            currentRevenue: number
            previousRevenue: number
        }> = []

        const allSkus = new Set([
            ...currentRevenueBySku.keys(),
            ...prevRevenueBySku.keys(),
        ])

        for (const sku of allSkus) {
            const current = currentRevenueBySku.get(sku) || 0
            const previous = prevRevenueBySku.get(sku) || 0
            const delta = current - previous

            if (delta !== 0) {
                deltas.push({
                    sku,
                    delta,
                    currentRevenue: current,
                    previousRevenue: previous,
                })
            }
        }

        const toDailyItem = (item: (typeof deltas)[0]) => ({
            sku: item.sku,
            productName: resolveProductName(item.sku, nameMap),
            delta: item.delta,
            currentRevenue: item.currentRevenue,
            previousRevenue: item.previousRevenue,
        })

        const gainers = deltas
            .filter((item) => item.delta > 0)
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 7)
            .map(toDailyItem)

        const losers = deltas
            .filter((item) => item.delta < 0)
            .sort((a, b) => a.delta - b.delta)
            .slice(0, 7)
            .map(toDailyItem)

        const validatedResponse = DailyResponseSchema.parse({ gainers, losers })
        return NextResponse.json(validatedResponse)
    } catch (error) {
        console.error("Target daily API error:", error)
        return NextResponse.json(
            {
                error: "Failed to fetch daily target data",
                message:
                    error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        )
    }
}
