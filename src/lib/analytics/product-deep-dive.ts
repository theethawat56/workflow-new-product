import "server-only"
import { classifyOrderChannel } from "@/lib/sales/channel"
import {
    CHANNEL_GROUP_ORDER,
    buildChannelInsight,
    getChannelGroup,
} from "./channel-groups"
import {
    DEFAULT_LEAD_TIME,
    VELOCITY_ACCEL_RATIO,
    Z_BY_SERVICE,
    getCohort,
    stockStatus,
} from "./constants"
import { getAnalyticsSalesContext } from "./data"
import { runRuleEngine } from "./rule-engine"
import type {
    ChannelGroupMetrics,
    MonthlyTrendPoint,
    ProductDeepDiveData,
    SalesOrderRow,
    SkuPeriodKpis,
    SkuYoYDelta,
} from "./types"

function aggregateSkuPeriod(
    rows: SalesOrderRow[],
    costMap: Map<string, number>,
): SkuPeriodKpis {
    let revenue = 0
    let units = 0
    let netGp = 0
    const orders = new Set<number>()

    for (const r of rows) {
        const unitCost = costMap.get(r.sku) ?? 0
        const channel = classifyOrderChannel(
            r.channel_raw,
            r.marketplace_name,
            r.integration_name,
        )
        revenue += r.line_total
        units += r.quantity
        netGp += r.line_total * (1 - channel.deduction) - r.quantity * unitCost
        orders.add(r.order_id)
    }

    return {
        revenue,
        units,
        avgSellPrice: units > 0 ? revenue / units : null,
        grossMarginPct: revenue > 0 ? (netGp / revenue) * 100 : null,
        grossProfit: netGp,
        orders: orders.size,
    }
}

function pctDelta(cur: number, prev: number): number | null {
    if (prev === 0) return cur > 0 ? 1 : null
    return (cur - prev) / prev
}

function dailyAvgForSku(
    rows: SalesOrderRow[],
    endDate: string,
    days: number,
): number {
    const end = new Date(endDate)
    const start = new Date(end)
    start.setDate(start.getDate() - (days - 1))
    const startStr = start.toISOString().slice(0, 10)
    let total = 0
    for (const r of rows) {
        if (r.order_date >= startStr && r.order_date <= endDate) {
            total += r.quantity
        }
    }
    return total / days
}

function dailyStdForSku(
    rows: SalesOrderRow[],
    endDate: string,
    days: number,
): number {
    const end = new Date(endDate)
    const start = new Date(end)
    start.setDate(start.getDate() - (days - 1))
    const daily = new Map<string, number>()
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        daily.set(d.toISOString().slice(0, 10), 0)
    }
    for (const r of rows) {
        if (daily.has(r.order_date)) {
            daily.set(r.order_date, (daily.get(r.order_date) ?? 0) + r.quantity)
        }
    }
    const values = [...daily.values()]
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
        values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
}

function buildMonthlyTrend(
    rows: SalesOrderRow[],
    dataAsOf: string,
): { trend: MonthlyTrendPoint[]; firstSaleMonth: string | null } {
    const end = new Date(dataAsOf)
    const start = new Date(end)
    start.setMonth(start.getMonth() - 17)

    const months: string[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cursor <= endMonth) {
        months.push(
            `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
        )
        cursor.setMonth(cursor.getMonth() + 1)
    }

    const byMonth = new Map<string, { units: number; revenue: number }>()
    for (const m of months) byMonth.set(m, { units: 0, revenue: 0 })

    let firstSale: string | null = null
    for (const r of rows) {
        const m = r.order_date.slice(0, 7)
        if (!byMonth.has(m)) continue
        const cur = byMonth.get(m)!
        cur.units += r.quantity
        cur.revenue += r.line_total
        if (!firstSale || m < firstSale) firstSale = m
    }

    const unitsSeries = months.map((m) => byMonth.get(m)!.units)
    const trend: MonthlyTrendPoint[] = months.map((m, i) => {
        let ma3: number | null = null
        if (i >= 2) {
            ma3 = (unitsSeries[i] + unitsSeries[i - 1] + unitsSeries[i - 2]) / 3
        }
        return {
            month: m,
            units: byMonth.get(m)!.units,
            revenue: byMonth.get(m)!.revenue,
            unitsMa3: ma3,
            isFirstSale: m === firstSale,
        }
    })

    return { trend, firstSaleMonth: firstSale }
}

function buildChannelBreakdown(
    rows: SalesOrderRow[],
    costMap: Map<string, number>,
): ChannelGroupMetrics[] {
    const acc = new Map<
        string,
        { revenue: number; netGp: number }
    >()
    for (const g of CHANNEL_GROUP_ORDER) acc.set(g, { revenue: 0, netGp: 0 })

    for (const r of rows) {
        const group = getChannelGroup(
            r.channel_raw,
            r.marketplace_name,
            r.integration_name,
        )
        const unitCost = costMap.get(r.sku) ?? 0
        const channel = classifyOrderChannel(
            r.channel_raw,
            r.marketplace_name,
            r.integration_name,
        )
        const cur = acc.get(group)!
        cur.revenue += r.line_total
        cur.netGp += r.line_total * (1 - channel.deduction) - r.quantity * unitCost
    }

    const totalRev = [...acc.values()].reduce((s, v) => s + v.revenue, 0)
    return CHANNEL_GROUP_ORDER.map((group) => {
        const v = acc.get(group)!
        return {
            group,
            revenue: v.revenue,
            share: totalRev > 0 ? (v.revenue / totalRev) * 100 : 0,
            gmPct: v.revenue > 0 ? (v.netGp / v.revenue) * 100 : null,
        }
    })
}

function computeMedianCohortUnits(
    sales: SalesOrderRow[],
    costMap: Map<string, number>,
    nameMap: Map<string, string>,
    from: string,
    to: string,
): number {
    const window = sales.filter((r) => r.order_date >= from && r.order_date <= to)
    const acc = new Map<string, number>()
    for (const r of window) {
        const c = getCohort(r.sku)
        if (c !== "NEW_2026" && c !== "NEW_2025") continue
        acc.set(r.sku, (acc.get(r.sku) ?? 0) + r.quantity)
    }
    const units = [...acc.values()].sort((a, b) => a - b)
    if (units.length === 0) return 0
    return units[Math.floor(units.length / 2)] ?? 0
}

export async function loadProductDeepDive(
    rawSku: string,
): Promise<ProductDeepDiveData | null> {
    const sku = rawSku.trim().toUpperCase()
    if (!sku) return null

    const ctx = await getAnalyticsSalesContext()
    const skuRows = ctx.sales.filter((r) => r.sku.toUpperCase() === sku)
    const productName =
        skuRows.find((r) => r.product_name)?.product_name ??
        ctx.nameMap.get(sku) ??
        sku

    const cohort = getCohort(sku)
    const seasonality = (() => {
        const monthly = new Array(12).fill(0)
        let total = 0
        for (const r of ctx.sales2025.filter((x) => x.sku.toUpperCase() === sku)) {
            const m = new Date(r.order_date).getMonth()
            monthly[m] += r.quantity
            total += r.quantity
        }
        if (total === 0) return "YEAR-ROUND" as const
        const summer = monthly[2] + monthly[3] + monthly[4] + monthly[5] + monthly[6]
        return summer / total > 0.55
            ? ("SEASONAL (summer)" as const)
            : ("YEAR-ROUND" as const)
    })()

    const ytd2026Rows = skuRows.filter(
        (r) => r.order_date >= ctx.ytd2026From && r.order_date <= ctx.ytd2026To,
    )
    const ytd2025Rows = skuRows.filter(
        (r) => r.order_date >= ctx.ytd2025From && r.order_date <= ctx.ytd2025To,
    )

    const ytd2026 = aggregateSkuPeriod(ytd2026Rows, ctx.costMap)
    const ytd2025 =
        ytd2025Rows.length > 0
            ? aggregateSkuPeriod(ytd2025Rows, ctx.costMap)
            : null

    const hasPriorYear = ytd2025 != null && ytd2025.units > 0
    const ytdDelta: SkuYoYDelta = {
        hasPriorYear,
        revenuePct: hasPriorYear
            ? pctDelta(ytd2026.revenue, ytd2025!.revenue)
            : null,
        unitsPct: hasPriorYear
            ? pctDelta(ytd2026.units, ytd2025!.units)
            : null,
        grossMarginPctDelta:
            ytd2026.grossMarginPct != null &&
            ytd2025?.grossMarginPct != null
                ? ytd2026.grossMarginPct - ytd2025.grossMarginPct
                : null,
        grossProfitPct: hasPriorYear
            ? pctDelta(ytd2026.grossProfit, ytd2025!.grossProfit)
            : null,
    }

    const { trend, firstSaleMonth } = buildMonthlyTrend(skuRows, ctx.dataAsOf)
    const channelBreakdown = buildChannelBreakdown(ytd2026Rows, ctx.costMap)
    const channelInsight = buildChannelInsight(channelBreakdown)

    const dailyAvg30 = dailyAvgForSku(skuRows, ctx.dataAsOf, 30)
    const dailyAvg60 = dailyAvgForSku(skuRows, ctx.dataAsOf, 60)
    const dailyAvg90 = dailyAvgForSku(skuRows, ctx.dataAsOf, 90)
    const dailyStd = dailyStdForSku(skuRows, ctx.dataAsOf, 90)
    const velocityAccelerating =
        dailyAvg90 > 0 && dailyAvg30 > dailyAvg90 * VELOCITY_ACCEL_RATIO
    const ropDailyAvg = velocityAccelerating ? dailyAvg30 : dailyAvg90
    const z = Z_BY_SERVICE[90]
    const leadTime = DEFAULT_LEAD_TIME
    const safetyStock = z * dailyStd * Math.sqrt(leadTime)
    const reorderPoint = ropDailyAvg * leadTime + safetyStock
    const minOrderQty = ropDailyAvg * leadTime
    const currentStock = ctx.stockBySku.get(sku) ?? null
    const coverDays =
        currentStock != null && ropDailyAvg > 0
            ? currentStock / ropDailyAvg
            : null

    const medianUnits = computeMedianCohortUnits(
        ctx.sales,
        ctx.costMap,
        ctx.nameMap,
        ctx.ytd2026From,
        ctx.ytd2026To,
    )

    const topChannel =
        [...channelBreakdown].sort((a, b) => b.revenue - a.revenue)[0]?.group ??
        null
    const bestMarginChannel =
        [...channelBreakdown]
            .filter((c) => c.gmPct != null)
            .sort((a, b) => (b.gmPct ?? 0) - (a.gmPct ?? 0))[0]?.group ?? null

    const { verdict, reason, actions } = runRuleEngine({
        gmPct: ytd2026.grossMarginPct,
        unitsYtd: ytd2026.units,
        medianUnits,
        currentStock,
        reorderPoint,
        minOrderQty,
        coverDays,
        velocityAccelerating,
        seasonality,
        nowMonth: new Date().getMonth(),
        topChannel,
        bestMarginChannel,
        cohort,
    })

    return {
        sku,
        productName,
        cohort,
        seasonality,
        dataAsOf: ctx.dataAsOf,
        ytd2026From: ctx.ytd2026From,
        ytd2026To: ctx.ytd2026To,
        ytd2025From: ctx.ytd2025From,
        ytd2025To: ctx.ytd2025To,
        verdict,
        verdictReason: reason,
        actions,
        medianUnits,
        ytd2026,
        ytd2025,
        ytdDelta,
        monthlyTrend: trend,
        firstSaleMonth,
        channelBreakdown,
        channelInsight,
        stock: {
            dailyAvg30,
            dailyAvg60,
            dailyAvg90,
            dailyStd,
            velocityAccelerating,
            ropDailyAvg,
            safetyStock,
            reorderPoint,
            minOrderQty,
            currentStock,
            coverDays,
            status: stockStatus(currentStock, reorderPoint),
        },
    }
}
