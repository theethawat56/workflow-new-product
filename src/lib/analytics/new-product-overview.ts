import "server-only"
import { classifyOrderChannel } from "@/lib/sales/channel"
import { getCohort } from "./constants"
import { getAnalyticsSalesContext } from "./data"
import type { MonthlyGpPricePoint, SalesOrderRow } from "./types"

export interface NewProductSkuRow {
    sku: string
    productName: string
    revenue: number
    units: number
    grossProfit: number
    gmPct: number | null
    isLoss: boolean
}

export interface NewProductOverview {
    dataAsOf: string
    ytd2026From: string
    ytd2026To: string
    cohortLabel: string
    // Headline KPIs (New 2026 only, YTD)
    revenueYtd: number
    unitsYtd: number
    ordersYtd: number
    grossProfitYtd: number
    weightedGmPct: number
    avgSellPrice: number | null
    // Contribution
    companyRevenueYtd: number
    shareOfCompanyPct: number
    // SKU coverage
    skuCount: number
    activeSkuCount: number
    zeroSaleSkus: string[]
    // Trends
    monthlyGpPrice: MonthlyGpPricePoint[]
    gpTrendPct: number | null
    priceTrendPct: number | null
    // Leaderboards
    topByRevenue: NewProductSkuRow[]
    topByGrossProfit: NewProductSkuRow[]
    lossSkus: NewProductSkuRow[]
}

function netGpOf(r: SalesOrderRow, unitCost: number): number {
    const channel = classifyOrderChannel(
        r.channel_raw,
        r.marketplace_name,
        r.integration_name,
    )
    return r.line_total * (1 - channel.deduction) - r.quantity * unitCost
}

export async function loadNewProductOverview(): Promise<NewProductOverview> {
    const ctx = await getAnalyticsSalesContext()
    const isNew2026 = (sku: string) => getCohort(sku) === "NEW_2026"

    const ytd2026 = ctx.sales.filter(
        (r) => r.order_date >= ctx.ytd2026From && r.order_date <= ctx.ytd2026To,
    )
    const companyRevenueYtd = ytd2026.reduce((s, r) => s + r.line_total, 0)

    const newYtd = ytd2026.filter((r) => isNew2026(r.sku))

    // Per-SKU aggregation
    const bySku = new Map<
        string,
        { revenue: number; units: number; netGp: number; name: string; orders: Set<number> }
    >()
    const orderSet = new Set<number>()
    let revenue = 0
    let units = 0
    let grossProfit = 0

    for (const r of newYtd) {
        const unitCost = ctx.costMap.get(r.sku) ?? 0
        const gp = netGpOf(r, unitCost)
        revenue += r.line_total
        units += r.quantity
        grossProfit += gp
        orderSet.add(r.order_id)

        const cur =
            bySku.get(r.sku) ??
            {
                revenue: 0,
                units: 0,
                netGp: 0,
                name: ctx.nameMap.get(r.sku) ?? r.product_name ?? r.sku,
                orders: new Set<number>(),
            }
        cur.revenue += r.line_total
        cur.units += r.quantity
        cur.netGp += gp
        cur.orders.add(r.order_id)
        if (r.product_name) cur.name = r.product_name
        bySku.set(r.sku, cur)
    }

    const skuRows: NewProductSkuRow[] = [...bySku.entries()].map(([sku, v]) => {
        const hasCost = ctx.costMap.has(sku)
        const gmPct = v.revenue > 0 && hasCost ? (v.netGp / v.revenue) * 100 : null
        return {
            sku,
            productName: v.name,
            revenue: v.revenue,
            units: v.units,
            grossProfit: hasCost ? v.netGp : 0,
            gmPct,
            isLoss: gmPct != null && gmPct < 0,
        }
    })

    const weightedGmPct =
        revenue > 0
            ? (skuRows
                  .filter((s) => s.gmPct != null)
                  .reduce((a, s) => a + s.grossProfit, 0) /
                  skuRows
                      .filter((s) => s.gmPct != null)
                      .reduce((a, s) => a + s.revenue, 0)) *
              100
            : 0

    // Full New 2026 SKU universe (from cohort list) → coverage
    const cohortSkuUniverse = new Set<string>()
    for (const r of ctx.sales) {
        if (isNew2026(r.sku)) cohortSkuUniverse.add(r.sku.toUpperCase())
    }
    // Include listed cohort SKUs even with zero sales, from constants via getCohort:
    // reconstruct by scanning nameMap keys that classify as NEW_2026
    for (const sku of ctx.nameMap.keys()) {
        if (isNew2026(sku)) cohortSkuUniverse.add(sku.toUpperCase())
    }
    const activeSkus = new Set(skuRows.filter((s) => s.units > 0).map((s) => s.sku.toUpperCase()))
    const zeroSaleSkus = [...cohortSkuUniverse].filter((s) => !activeSkus.has(s)).sort()

    // Monthly GP + ASP scoped to New 2026, trailing 18 months
    const monthlyGpPrice: MonthlyGpPricePoint[] = (() => {
        const end = new Date(ctx.dataAsOf)
        const months: string[] = []
        const cursor = new Date(end.getFullYear(), end.getMonth() - 17, 1)
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
        while (cursor <= endMonth) {
            months.push(
                `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
            )
            cursor.setMonth(cursor.getMonth() + 1)
        }
        const acc = new Map<string, { revenue: number; units: number; netGp: number }>()
        for (const m of months) acc.set(m, { revenue: 0, units: 0, netGp: 0 })
        for (const r of ctx.sales) {
            if (!isNew2026(r.sku)) continue
            const m = r.order_date.slice(0, 7)
            const bucket = acc.get(m)
            if (!bucket) continue
            const unitCost = ctx.costMap.get(r.sku) ?? 0
            bucket.revenue += r.line_total
            bucket.units += r.quantity
            bucket.netGp += netGpOf(r, unitCost)
        }
        return months.map((month) => {
            const v = acc.get(month)!
            return {
                month,
                revenue: v.revenue,
                units: v.units,
                grossProfit: v.netGp,
                gmPct: v.revenue > 0 ? (v.netGp / v.revenue) * 100 : null,
                avgSellPrice: v.units > 0 ? v.revenue / v.units : null,
            }
        })
    })()

    // Trend: last 3 months vs prior 3 months (on the scoped monthly series)
    function trendPct(pick: (p: MonthlyGpPricePoint) => number | null): number | null {
        const vals = monthlyGpPrice.map(pick)
        const n = vals.length
        if (n < 6) return null
        const last3 = vals.slice(n - 3).filter((v): v is number => v != null)
        const prev3 = vals.slice(n - 6, n - 3).filter((v): v is number => v != null)
        if (last3.length === 0 || prev3.length === 0) return null
        const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
        const prevAvg = avg(prev3)
        if (prevAvg === 0) return null
        return (avg(last3) - prevAvg) / prevAvg
    }

    const gpTrendPct = trendPct((p) => p.grossProfit)
    const priceTrendPct = trendPct((p) => p.avgSellPrice)

    const topByRevenue = [...skuRows].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    const topByGrossProfit = [...skuRows]
        .sort((a, b) => b.grossProfit - a.grossProfit)
        .slice(0, 10)
    const lossSkus = skuRows.filter((s) => s.isLoss).sort((a, b) => a.gmPct! - b.gmPct!)

    return {
        dataAsOf: ctx.dataAsOf,
        ytd2026From: ctx.ytd2026From,
        ytd2026To: ctx.ytd2026To,
        cohortLabel: "New 2026",
        revenueYtd: revenue,
        unitsYtd: units,
        ordersYtd: orderSet.size,
        grossProfitYtd: grossProfit,
        weightedGmPct,
        avgSellPrice: units > 0 ? revenue / units : null,
        companyRevenueYtd,
        shareOfCompanyPct: companyRevenueYtd > 0 ? (revenue / companyRevenueYtd) * 100 : 0,
        skuCount: cohortSkuUniverse.size,
        activeSkuCount: activeSkus.size,
        zeroSaleSkus,
        monthlyGpPrice,
        gpTrendPct,
        priceTrendPct,
        topByRevenue,
        topByGrossProfit,
        lossSkus,
    }
}
