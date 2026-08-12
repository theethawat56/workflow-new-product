/**
 * New Product Launch Command Center — server-only data layer.
 * Integrates Sales × Stock × KOL per product group (New 2026).
 */

import "server-only"
import { unstable_cache } from "next/cache"
import { format, isValid, subDays } from "date-fns"
import { google } from "googleapis"
import { classifyOrderChannel } from "@/lib/sales/channel"
import {
    buildStockQtyRecord,
    stockAtSku,
    toStockQtyMap,
} from "@/lib/stock/stock-at-columns"
import {
    buildNewLaunchSkuSetForYear,
    type LaunchedProductRow,
    type ProductGoLiveRow,
} from "@/lib/sales/cohort"
import {
    ALERT_PRIORITY,
    DEFAULT_LEAD_TIME_DAYS,
    GP_TARGET_PCT,
    MKTG_TARGET_LAUNCH_HIGH,
    MKTG_TARGET_LAUNCH_LOW,
    RUN_RATE_HIT,
    SEED_CAP_HIGH,
    TIER_KOL_TARGETS,
    VERDICT_PRIORITY,
    computeRunRate,
    marginStatus,
    mktgStatus,
    mktgTargetPct,
    runRateProgressGoal,
    runRateProgressPctWithGoal,
    runRateStatusWithGoal,
    salesTargetForMonth,
    type RunRateResult,
    tierFromAsp,
    type LaunchAlertType,
    type LaunchVerdict,
    type ProductTier,
} from "./launch-constants"
import type {
    LaunchCommandCenterData,
    LaunchGroupDetail,
    MonthlyLaunchRow,
    PortfolioAlertItem,
    PortfolioRollup,
    PortfolioRow,
    ProductGroupOption,
    ScatterPoint,
} from "./launch-types"
import { loadProgressGoalOverrides } from "./launch-progress-targets"
import type { PoCostRow, SalesOrderRow } from "./types"

function sheetsAuth() {
    return new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })
}

async function readTab(tab: string): Promise<Record<string, string>[]> {
    const spreadsheetId =
        process.env.GOOGLE_SHEETS_ID ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined")
    const sheets = google.sheets({ version: "v4", auth: sheetsAuth() })
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: tab })
    const values = res.data.values ?? []
    if (values.length < 2) return []
    const header = values[0].map((h) => String(h).trim())
    return values.slice(1).map((row) =>
        Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])),
    )
}

function num(v: string | undefined): number {
    if (v == null || v === "") return 0
    const n = Number(String(v).replace(/,/g, ""))
    return Number.isFinite(n) ? n : 0
}

function parseSales(raw: Record<string, string>[]): SalesOrderRow[] {
    return raw.map((r) => ({
        row_id: String(r.row_id ?? ""),
        order_id: num(r.order_id),
        order_number: String(r.order_number ?? ""),
        order_date: String(r.order_date ?? "").slice(0, 10),
        success_date: String(r.success_date ?? ""),
        status: String(r.status ?? ""),
        payment_status: String(r.payment_status ?? ""),
        channel_raw: String(r.channel_raw ?? ""),
        marketplace_name: String(r.marketplace_name ?? ""),
        integration_name: String(r.integration_name ?? ""),
        sku: String(r.sku ?? "").trim(),
        product_name: String(r.product_name ?? "").trim(),
        is_bundle: num(r.is_bundle),
        quantity: num(r.quantity),
        unit_price: num(r.unit_price),
        unit_price_pretax: num(r.unit_price_pretax),
        line_total: num(r.line_total),
        line_total_pretax: num(r.line_total_pretax),
        line_discount: num(r.line_discount),
        synced_at: String(r.synced_at ?? ""),
    }))
}

function parseCosts(raw: Record<string, string>[]): PoCostRow[] {
    return raw.map((r) => ({
        sku: String(r.sku ?? "").trim(),
        product_name: String(r.product_name ?? "").trim(),
        total_qty: num(r.total_qty),
        total_value_pretax: num(r.total_value_pretax),
        weighted_avg_cost: num(r.weighted_avg_cost),
        latest_po_date: String(r.latest_po_date ?? ""),
        earliest_po_date: String(r.earliest_po_date ?? ""),
        po_count: num(r.po_count),
        synced_at: String(r.synced_at ?? ""),
    }))
}

/** KOL Post Date — US format M/D/YYYY (month first). */
export function parseUsKolDate(raw: string | undefined): string | null {
    if (!raw?.trim()) return null
    const s = raw.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

    const excel = parseFloat(s)
    if (!isNaN(excel) && excel > 30000 && excel < 60000) {
        const date = new Date((excel - 25569) * 86400 * 1000)
        return isValid(date) ? format(date, "yyyy-MM-dd") : null
    }

    const parts = s.split(/[\/\-]/)
    if (parts.length !== 3) return null
    const month = parseInt(parts[0], 10)
    const day = parseInt(parts[1], 10)
    let year = parseInt(parts[2], 10)
    if (year < 100) year += 2000
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const date = new Date(year, month - 1, day)
    return isValid(date) ? format(date, "yyyy-MM-dd") : null
}

interface KolPost {
    postDate: string
    month: string
    sku: string
    budgetType: "barter" | "cash" | "other"
    /** True when the KOL received product (barter, product+cash, both). */
    givesProduct: boolean
    budgetAmount: number
    isSeed: boolean
}

interface ProductMasterRow {
    sku: string
    groupId: string
    aspTarget: number
    tier: ProductTier | null
    label: string
}

interface StockLotRow {
    sku: string
    lotNo: string
    qtyOrdered: number
    orderDate: string
    arrivalDate: string
}

function isExcludedChannel(raw: string): boolean {
    const lower = raw.toLowerCase()
    return /wfm|งานซ่อม|งานเคลม|claim|review|ของแถม|ฝากขาย|แจก/.test(lower)
}

function isValidSale(r: SalesOrderRow): boolean {
    return (
        r.status === "Success" &&
        r.line_total > 0 &&
        Boolean(r.sku) &&
        Boolean(r.order_date) &&
        !isExcludedChannel(r.channel_raw)
    )
}

function netGpLine(r: SalesOrderRow, cogs: number): number {
    const ch = classifyOrderChannel(r.channel_raw, r.marketplace_name, r.integration_name)
    if (ch.category === "OTHER") return 0
    return r.line_total * (1 - ch.deduction) - cogs * r.quantity
}

function monthKey(date: string): string {
    return date.slice(0, 7)
}

function parseProductMaster(raw: Record<string, string>[]): Map<string, ProductMasterRow> {
    const map = new Map<string, ProductMasterRow>()
    for (const r of raw) {
        const sku = String(r.sku ?? r.SKU ?? "").trim().toUpperCase()
        if (!sku) continue
        const groupId = String(r.group_id ?? r.groupId ?? sku).trim().toUpperCase()
        const aspTarget = num(r.asp_target ?? r.aspTarget)
        const tierRaw = String(r.tier ?? "").trim()
        const tier =
            tierRaw === "ถูก" || tierRaw === "กลาง" || tierRaw === "สูง" || tierRaw === "พรีเมียม"
                ? (tierRaw as ProductTier)
                : null
        const label = String(r.product_name ?? r.label ?? r.name ?? "").trim()
        map.set(sku, { sku, groupId, aspTarget, tier, label })
    }
    return map
}

function parseKolPosts(raw: Record<string, string>[]): KolPost[] {
    const posts: KolPost[] = []
    for (const r of raw) {
        const postDate = parseUsKolDate(String(r["Post Date"] ?? ""))
        if (!postDate) continue
        const sku = String(r["ATB Code"] ?? r["SKU"] ?? r["Code"] ?? "")
            .trim()
            .toUpperCase()
        if (!sku) continue

        const typeRaw = String(r["Budget type"] ?? r["Budget Type"] ?? "").toLowerCase()
        const kolType = String(r["KOL Type"] ?? "").toLowerCase()
        let budgetType: KolPost["budgetType"] = "other"
        // Cash before barter — PRODUCT_CASH / BOTH must not match generic "product".
        if (/^cash$|product_cash|both|เงิน|paid|จ้าง/.test(typeRaw) || /\bcash\b/.test(typeRaw)) {
            budgetType = "cash"
        } else if (/barter|product_barter|affiliate|ของ/.test(typeRaw)) {
            budgetType = "barter"
        }
        // PRODUCT_CASH / BOTH give product on top of cash.
        const givesProduct =
            budgetType === "barter" || /product_cash|both|product/.test(typeRaw)

        let budgetAmount = num(r["Budget Final"])
        if (budgetAmount === 0) budgetAmount = num(r["Budget amount"])

        const isSeed = /seed|review|รีวิว/.test(kolType) || /seed|review/.test(typeRaw)

        posts.push({
            postDate,
            month: monthKey(postDate),
            sku,
            budgetType,
            givesProduct,
            budgetAmount,
            isSeed,
        })
    }
    return posts
}

function parseStockLots(raw: Record<string, string>[]): {
    stockBySku: Record<string, number>
    lots: StockLotRow[]
} {
    const stockBySku = buildStockQtyRecord(raw)
    const lots: StockLotRow[] = []
    const hasLotCols = raw.some(
        (r) => r.lot_no || r["Lot No"] || r.qty_ordered || r["Qty Ordered"],
    )

    for (const r of raw) {
        const sku = stockAtSku(r)
        if (!sku) continue

        if (hasLotCols) {
            const lotNo = String(r.lot_no ?? r["Lot No"] ?? r.lot ?? "Lot").trim()
            const qty = num(r.qty_ordered ?? r["Qty Ordered"] ?? r.qty)
            const orderDate = String(r.order_date ?? r["Order Date"] ?? "").slice(0, 10)
            const arrivalDate = String(r.arrival_date ?? r["Arrival Date"] ?? "").slice(0, 10)
            if (qty > 0 || orderDate) {
                lots.push({ sku, lotNo, qtyOrdered: qty, orderDate, arrivalDate })
            }
        }
    }
    return { stockBySku, lots }
}

function parseLaunched(raw: Record<string, string>[]): Record<string, string> {
    const map: Record<string, string> = {}
    for (const r of raw) {
        const sku = String(r.zort_sku ?? r.sku ?? "").trim().toUpperCase()
        const ld = String(r.launch_date ?? "").slice(0, 10)
        if (sku && ld) map[sku] = ld
    }
    return map
}

function parseLaunchedProducts(raw: Record<string, string>[]): LaunchedProductRow[] {
    return raw
        .map((r) => ({
            zort_sku: String(r.zort_sku ?? r.sku ?? "").trim(),
            launch_date: String(r.launch_date ?? "").slice(0, 10),
            product_name: String(r.product_name ?? "").trim(),
            status: String(r.status ?? "").trim(),
            launch_type: String(r.launch_type ?? "").trim(),
        }))
        .filter((lp) => lp.zort_sku)
}

function parseProductsGoLive(raw: Record<string, string>[]): ProductGoLiveRow[] {
    return raw
        .map((r) => ({
            sku_code: String(r.sku_code ?? r.SKU ?? r.sku ?? "").trim(),
            go_live_date: String(r.go_live_date ?? "").slice(0, 10) || undefined,
        }))
        .filter((p) => p.sku_code)
}

interface GroupBuild {
    groupId: string
    skus: string[]
    label: string
    tier: ProductTier | null
    aspTarget: number
}

function buildGroups(
    newSkus: string[],
    master: Map<string, ProductMasterRow>,
    costs: PoCostRow[],
    sales: SalesOrderRow[],
): GroupBuild[] {
    const byGroup = new Map<string, GroupBuild>()
    const costMap = new Map(costs.map((c) => [c.sku.toUpperCase(), c]))
    const nameFromSales = new Map<string, string>()
    for (const s of sales) {
        if (s.product_name) nameFromSales.set(s.sku.toUpperCase(), s.product_name)
    }

    for (const sku of newSkus) {
        const m = master.get(sku)
        const groupId = m?.groupId ?? sku
        const existing = byGroup.get(groupId)
        if (existing) {
            existing.skus.push(sku)
        } else {
            const cost = costMap.get(sku)
            byGroup.set(groupId, {
                groupId,
                skus: [sku],
                label: m?.label || cost?.product_name || nameFromSales.get(sku) || groupId,
                tier: m?.tier ?? null,
                aspTarget: m?.aspTarget ?? 0,
            })
        }
    }
    return [...byGroup.values()].sort((a, b) => a.label.localeCompare(b.label, "th"))
}

function weightedCogs(skus: string[], costMap: Map<string, PoCostRow>): number {
    let sum = 0
    let qty = 0
    for (const sku of skus) {
        const c = costMap.get(sku)
        if (c && c.weighted_avg_cost > 0) {
            sum += c.weighted_avg_cost
            qty++
        }
    }
    return qty > 0 ? sum / qty : 0
}

function evaluateVerdict(
    runRate: number,
    monthIndex: number,
    netMarginPct: number,
    daysCover: number | null,
    leadTime: number,
    seedCapPct: number,
    alerts: LaunchAlertType[],
): LaunchVerdict {
    if (alerts.includes("MARGIN-FAIL")) return "MARGIN-FAIL"
    if (alerts.includes("STOCK-RISK")) return "STOCK-RISK"
    if (alerts.includes("OVER-SEEDING")) return "OVER-SEEDING"

    const target = salesTargetForMonth(monthIndex)
    if (monthIndex >= 2 && runRate < target.low) return "BEHIND"
    if (netMarginPct >= GP_TARGET_PCT && runRate >= target.low * 0.8) return "ON-TRACK"
    if (runRate < target.low && monthIndex >= 2) return "BEHIND"
    if (daysCover != null && daysCover < leadTime && runRate >= RUN_RATE_HIT * 0.5)
        return "STOCK-RISK"
    if (seedCapPct > SEED_CAP_HIGH) return "OVER-SEEDING"
    return runRate >= target.low ? "ON-TRACK" : "BEHIND"
}

function buildAlerts(input: {
    runRate: number
    netMarginPct: number
    daysCover: number | null
    leadTime: number
    seedCapPct: number
    mktgPct: number | null
    mktgTarget: number
    barterPosts: number
    paidPosts: number
    tier: ProductTier
}): { alerts: LaunchAlertType[]; messages: string[] } {
    const alerts: LaunchAlertType[] = []
    const messages: string[] = []

    if (input.netMarginPct < GP_TARGET_PCT && input.runRate > 0) {
        alerts.push("MARGIN-FAIL")
        messages.push(`Net GP ${input.netMarginPct.toFixed(1)}% ต่ำกว่าเป้า ${GP_TARGET_PCT}%`)
    }
    if (
        input.daysCover != null &&
        input.daysCover < input.leadTime &&
        input.runRate >= RUN_RATE_HIT * 0.5
    ) {
        alerts.push("STOCK-RISK")
        messages.push(
            `Days cover ${Math.round(input.daysCover)} วัน < lead time ${input.leadTime} วัน — สั่ง Lot ถัดไป`,
        )
    }
    if (input.seedCapPct > SEED_CAP_HIGH) {
        alerts.push("OVER-SEEDING")
        messages.push(`Seed+barter ${input.seedCapPct.toFixed(0)}% เกินเพดาน ${SEED_CAP_HIGH}%`)
    }
    if (input.mktgPct != null && input.mktgPct > input.mktgTarget * 1.15) {
        alerts.push("BUDGET-OVER")
        messages.push(
            `Mktg ${input.mktgPct.toFixed(1)}% เกินเป้า milestone ${input.mktgTarget.toFixed(1)}%`,
        )
    }
    const tierTarget = TIER_KOL_TARGETS[input.tier]
    if (
        input.runRate >= RUN_RATE_HIT * 0.85 &&
        input.barterPosts > input.paidPosts * 2 &&
        tierTarget.paidPosts >= 5
    ) {
        alerts.push("SWITCH-TO-PAID")
        messages.push("ใกล้ 300K แต่ยัง barter เยอะ — พิจารณาสลับเป็นจ้าง")
    }

    return { alerts, messages }
}

function resolveKolPostsForPeriod(
    groupKol: KolPost[],
    kolByMonth: Map<
        string,
        { barter: number; paid: number; barterCost: number; cashCost: number; posts: number }
    >,
    runRateResult: RunRateResult,
    last30Str: string,
    cogs: number,
): { total: number; barter: number; paid: number; monthLabel: string; mktgCost: number } {
    if (
        (runRateResult.source === "prev_month" || runRateResult.source === "current_mtd") &&
        runRateResult.sourceMonth
    ) {
        const km = kolByMonth.get(runRateResult.sourceMonth)
        return {
            total: km?.posts ?? 0,
            barter: km?.barter ?? 0,
            paid: km?.paid ?? 0,
            monthLabel: runRateResult.sourceMonth,
            mktgCost: (km?.barterCost ?? 0) + (km?.cashCost ?? 0),
        }
    }

    if (runRateResult.source === "last_30d") {
        let barter = 0
        let paid = 0
        let other = 0
        let mktgCost = 0
        for (const p of groupKol) {
            if (p.postDate < last30Str) continue
            if (p.budgetType === "barter") barter++
            else if (p.budgetType === "cash") paid++
            else other++
            if (p.givesProduct) mktgCost += cogs
            if (p.budgetType === "cash") mktgCost += p.budgetAmount
        }
        return {
            total: barter + paid + other,
            barter,
            paid,
            monthLabel: "30 วัน",
            mktgCost,
        }
    }

    return { total: 0, barter: 0, paid: 0, monthLabel: "", mktgCost: 0 }
}

function buildPortfolio(
    details: LaunchGroupDetail[],
    progressGoalOverrides: Map<string, number>,
): {
    rollup: PortfolioRollup
    rows: PortfolioRow[]
    alerts: PortfolioAlertItem[]
    scatter: ScatterPoint[]
} {
    const verdictCounts: PortfolioRollup["verdictCounts"] = {
        "ON-TRACK": 0,
        BEHIND: 0,
        "STOCK-RISK": 0,
        "MARGIN-FAIL": 0,
        "OVER-SEEDING": 0,
    }

    let totalRunRate = 0
    let hit300kCount = 0
    let totalMktgCost = 0
    let totalRevForMktg = 0
    let totalNetGp = 0
    let totalRevForMargin = 0

    const rows: PortfolioRow[] = details.map((d) => {
        verdictCounts[d.verdict]++
        totalRunRate += d.runRate
        if (d.runRate >= RUN_RATE_HIT) hit300kCount++
        totalNetGp += d.cumulativeNetGp

        // Mktg = cash budget + product given (valued at COGS), same period as run-rate.
        const mktgPct = d.mktgPctPeriod
        const mktgTarget = d.mktgTargetPeriod
        totalMktgCost += d.mktgCostPeriod
        if (d.mktgCostPeriod > 0 || d.runRateMonthRev > 0) {
            totalRevForMktg += d.runRateMonthRev
        }
        if (d.runRate > 0) totalRevForMargin += d.runRate

        const defaultProgressGoal = runRateProgressGoal(d.monthIndex)
        const customGoal = progressGoalOverrides.get(d.groupId.toUpperCase())
        const progressGoal = customGoal ?? defaultProgressGoal
        const progressPct = runRateProgressPctWithGoal(d.runRate, progressGoal)
        const barStatus = runRateStatusWithGoal(d.runRate, progressGoal)

        return {
            groupId: d.groupId,
            label: d.label,
            tier: d.tier,
            monthIndex: d.monthIndex,
            runRate: d.runRate,
            runRateStatus: barStatus,
            runRateSource: d.runRateSource,
            runRateSourceMonth: d.runRateSourceMonth,
            progressPct,
            progressGoal,
            defaultProgressGoal,
            isCustomProgressGoal: customGoal != null,
            avgMonthlyRevenue: d.avgMonthlyRevenue,
            avgMonthlyUnits: d.avgMonthlyUnits,
            netMarginPct: d.netMarginPct,
            marginStatus: marginStatus(d.netMarginPct),
            mktgPct,
            mktgStatus: mktgStatus(mktgPct, mktgTarget),
            currentStock: d.currentStock,
            kolPostsPerMonth: d.kolPostsPerMonth,
            kolBarterPerMonth: d.kolBarterPerMonth,
            kolPaidPerMonth: d.kolPaidPerMonth,
            kolPostsMonthLabel: d.kolPostsMonthLabel,
            verdict: d.verdict,
            cumulativeNetGp: d.cumulativeNetGp,
        }
    })

    rows.sort((a, b) => {
        const vp = VERDICT_PRIORITY[a.verdict] - VERDICT_PRIORITY[b.verdict]
        if (vp !== 0) return vp
        return b.runRate - a.runRate
    })

    const alerts: PortfolioAlertItem[] = []
    for (const d of details) {
        d.alerts.forEach((alertType, i) => {
            alerts.push({
                groupId: d.groupId,
                label: d.label,
                alertType,
                message: d.alertMessages[i] ?? alertType,
                urgency: ALERT_PRIORITY[alertType],
            })
        })
    }
    alerts.sort((a, b) => a.urgency - b.urgency)

    const scatter: ScatterPoint[] = details.map((d) => ({
        groupId: d.groupId,
        label: d.label,
        monthIndex: d.monthIndex,
        runRate: d.runRate,
        netGp: d.cumulativeNetGp,
        verdict: d.verdict,
    }))

    const avgNetMarginPct =
        totalRevForMargin > 0
            ? details.reduce((s, d) => s + d.netMarginPct * d.runRate, 0) / totalRevForMargin
            : 0

    const rollup: PortfolioRollup = {
        verdictCounts,
        totalRunRate,
        hit300kCount,
        notHit300kCount: details.length - hit300kCount,
        totalMktgCost,
        portfolioMktgPct: totalRevForMktg > 0 ? (totalMktgCost / totalRevForMktg) * 100 : 0,
        mktgTargetPct: (MKTG_TARGET_LAUNCH_LOW + MKTG_TARGET_LAUNCH_HIGH) / 2,
        totalNetGp,
        avgNetMarginPct,
        productCount: details.length,
    }

    return { rollup, rows, alerts, scatter }
}

function computeGroupDetail(
    group: GroupBuild,
    sales: SalesOrderRow[],
    kolPosts: KolPost[],
    stockBySku: Map<string, number>,
    lots: StockLotRow[],
    costMap: Map<string, PoCostRow>,
    launchDates: Map<string, string>,
): LaunchGroupDetail {
    const skuSet = new Set(group.skus.map((s) => s.toUpperCase()))
    const groupSales = sales.filter((r) => skuSet.has(r.sku.toUpperCase()) && isValidSale(r))
    const cogs = weightedCogs(group.skus, costMap)

    let totalRev = 0
    let totalNetGp = 0
    let totalUnits = 0
    let mpRev = 0
    let directRev = 0

    const monthlySales = new Map<string, { revenue: number; units: number; netGp: number }>()

    for (const r of groupSales) {
        const gp = netGpLine(r, cogs)
        totalRev += r.line_total
        totalNetGp += gp
        totalUnits += r.quantity
        const ch = classifyOrderChannel(r.channel_raw, r.marketplace_name, r.integration_name)
        if (ch.category === "MARKETPLACE") mpRev += r.line_total
        else if (ch.category === "DIRECT") directRev += r.line_total

        const mk = monthKey(r.order_date)
        const cur = monthlySales.get(mk) ?? { revenue: 0, units: 0, netGp: 0 }
        cur.revenue += r.line_total
        cur.units += r.quantity
        cur.netGp += gp
        monthlySales.set(mk, cur)
    }

    const asp = totalUnits > 0 ? totalRev / totalUnits : group.aspTarget
    const tier = group.tier ?? tierFromAsp(asp)
    const netMarginPct = totalRev > 0 ? (totalNetGp / totalRev) * 100 : 0

    const sortedMonths = [...monthlySales.keys()].sort()
    const firstSaleMonth = sortedMonths[0] ?? null
    const launchCandidates = group.skus
        .map((s) => launchDates.get(s.toUpperCase()))
        .filter(Boolean) as string[]
    const launchDate =
        launchCandidates.sort()[0] ??
        (groupSales.length ? groupSales.map((s) => s.order_date).sort()[0] : null)

    const today = format(new Date(), "yyyy-MM-dd")
    const lastMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : monthKey(today)

    const last30Str = format(subDays(new Date(), 30), "yyyy-MM-dd")
    let runRate30 = 0
    let units30 = 0
    for (const r of groupSales) {
        if (r.order_date >= last30Str) {
            runRate30 += r.line_total
            units30 += r.quantity
        }
    }

    const monthlyRevenueMap = new Map<string, number>()
    for (const [m, v] of monthlySales) {
        monthlyRevenueMap.set(m, v.revenue)
    }
    const runRateResult = computeRunRate(monthlyRevenueMap, runRate30)
    const runRate = runRateResult.value

    const monthsWithSales = sortedMonths.filter(
        (m) => (monthlySales.get(m)?.revenue ?? 0) > 0,
    )
    const avgMonthlyRevenue =
        monthsWithSales.length > 0
            ? monthsWithSales.reduce((s, m) => s + (monthlySales.get(m)?.revenue ?? 0), 0) /
              monthsWithSales.length
            : 0
    const avgMonthlyUnits =
        monthsWithSales.length > 0
            ? monthsWithSales.reduce((s, m) => s + (monthlySales.get(m)?.units ?? 0), 0) /
              monthsWithSales.length
            : 0

    const avgDailyUnitsForCover =
        units30 > 0
            ? units30 / 30
            : avgMonthlyUnits > 0
              ? avgMonthlyUnits / 30
              : totalUnits > 0 && sortedMonths.length > 0
                ? totalUnits / Math.max(30 * sortedMonths.length, 30)
                : 0

    const monthIndex = firstSaleMonth
        ? Math.max(
              1,
              (parseInt(lastMonth.slice(0, 4), 10) - parseInt(firstSaleMonth.slice(0, 4), 10)) * 12 +
                  (parseInt(lastMonth.slice(5, 7), 10) - parseInt(firstSaleMonth.slice(5, 7), 10)) +
                  1,
          )
        : 0

    const groupKol = kolPosts.filter((p) => skuSet.has(p.sku))
    let seedUnits = 0
    let barterUnits = 0
    const kolByMonth = new Map<
        string,
        { barter: number; paid: number; barterCost: number; cashCost: number; posts: number }
    >()

    for (const p of groupKol) {
        const cur = kolByMonth.get(p.month) ?? {
            barter: 0,
            paid: 0,
            barterCost: 0,
            cashCost: 0,
            posts: 0,
        }
        cur.posts++
        // Product given away is always valued at COGS (barter, product+cash, both).
        if (p.givesProduct) {
            cur.barterCost += cogs
            barterUnits++
            if (p.isSeed) seedUnits++
        }
        if (p.budgetType === "barter") {
            cur.barter++
        } else if (p.budgetType === "cash") {
            cur.paid++
            cur.cashCost += p.budgetAmount
        }
        kolByMonth.set(p.month, cur)
    }

    const cumulativeKolCost = groupKol.reduce((sum, p) => {
        let cost = 0
        if (p.givesProduct) cost += cogs
        if (p.budgetType === "cash") cost += p.budgetAmount
        return sum + cost
    }, 0)

    const currentStock = group.skus.reduce(
        (sum, s) => sum + (stockBySku.get(s.toUpperCase()) ?? 0),
        0,
    )
    const daysCover =
        avgDailyUnitsForCover > 0 && currentStock > 0
            ? currentStock / avgDailyUnitsForCover
            : null

    const tierTarget = TIER_KOL_TARGETS[tier]
    const seedCapLimit = Math.round(tierTarget.unitsAt300k * (SEED_CAP_HIGH / 100))
    const seedCapPct = seedCapLimit > 0 ? ((seedUnits + barterUnits) / seedCapLimit) * 100 : 0

    const mktgTarget = mktgTargetPct(runRate, monthIndex)

    // Mktg cost/% for the SAME period as the run-rate (cash budget + barter at COGS).
    const kolPostsPeriod = resolveKolPostsForPeriod(
        groupKol,
        kolByMonth,
        runRateResult,
        last30Str,
        cogs,
    )

    // โพสต์/เดือน display = ALL posts the product ever had.
    let postsAllTotal = 0
    let postsAllBarter = 0
    let postsAllPaid = 0
    for (const p of groupKol) {
        postsAllTotal++
        if (p.budgetType === "barter") postsAllBarter++
        else if (p.budgetType === "cash") postsAllPaid++
    }
    const runRateMonthRev =
        runRateResult.sourceMonth != null
            ? (monthlySales.get(runRateResult.sourceMonth)?.revenue ?? runRate)
            : runRate
    const periodMktgCost = kolPostsPeriod.mktgCost
    const periodMktgPct =
        runRateMonthRev > 0 ? (periodMktgCost / runRateMonthRev) * 100 : null

    const { alerts, messages } = buildAlerts({
        runRate,
        netMarginPct,
        daysCover,
        leadTime: DEFAULT_LEAD_TIME_DAYS,
        seedCapPct,
        mktgPct: periodMktgPct,
        mktgTarget,
        barterPosts: kolPostsPeriod.barter,
        paidPosts: kolPostsPeriod.paid,
        tier,
    })

    const verdict = evaluateVerdict(
        runRate,
        monthIndex,
        netMarginPct,
        daysCover,
        DEFAULT_LEAD_TIME_DAYS,
        seedCapPct,
        alerts,
    )

    const barterOppCostPerUnit = cogs + (asp * 0.68 - cogs)
    const gpPerKol = cumulativeKolCost > 0 ? totalNetGp / cumulativeKolCost : null
    let barterRecommendation: "barter" | "paid" | "mixed" = "mixed"
    if (barterOppCostPerUnit <= 800) barterRecommendation = "barter"
    else if (barterOppCostPerUnit >= 1200) barterRecommendation = "paid"

    const allMonths = new Set([...sortedMonths, ...kolByMonth.keys()])
    const monthList = [...allMonths].sort()
    if (firstSaleMonth && !monthList.includes(firstSaleMonth)) monthList.unshift(firstSaleMonth)

    const monthlyTable: MonthlyLaunchRow[] = monthList.map((m, idx) => {
        const sm = monthlySales.get(m)
        const km = kolByMonth.get(m)
        const mktgCost = (km?.barterCost ?? 0) + (km?.cashCost ?? 0)
        const rev = sm?.revenue ?? 0
        const mi = idx + 1
        const target = salesTargetForMonth(mi)
        const runRateTarget = mi >= 3 ? target.low : target.high || target.low
        let runRateStatus: MonthlyLaunchRow["runRateStatus"] = "na"
        if (rev > 0) runRateStatus = rev >= target.low ? "hit" : "miss"
        const mktgPctRow = rev > 0 ? (mktgCost / rev) * 100 : null
        const dailyUnits = sm && sm.units > 0 ? sm.units / 30 : 0
        const stockEnd = m === lastMonth ? currentStock : null
        const dc = stockEnd != null && dailyUnits > 0 ? stockEnd / dailyUnits : null

        return {
            monthIndex: mi,
            monthLabel: m,
            units: sm?.units ?? 0,
            revenue: rev,
            netGp: sm?.netGp ?? 0,
            netMarginPct: rev > 0 ? ((sm?.netGp ?? 0) / rev) * 100 : null,
            mktgCost,
            mktgPct: mktgPctRow,
            kolPosts: km?.posts ?? 0,
            barterPosts: km?.barter ?? 0,
            paidPosts: km?.paid ?? 0,
            runRateTarget,
            runRateStatus,
            stockEnd,
            daysCover: dc,
        }
    })

    const salesMonthly = monthList.map((m, idx) => {
        const sm = monthlySales.get(m)
        const t = salesTargetForMonth(idx + 1)
        return {
            month: m,
            revenue: sm?.revenue ?? 0,
            units: sm?.units ?? 0,
            targetLow: t.low,
            targetHigh: t.high,
        }
    })

    const kolMonthly = monthList.map((m) => {
        const km = kolByMonth.get(m)
        const rev = monthlySales.get(m)?.revenue ?? 0
        const mktgCost = (km?.barterCost ?? 0) + (km?.cashCost ?? 0)
        const mi = monthList.indexOf(m) + 1
        return {
            month: m,
            mktgCost,
            mktgPct: rev > 0 ? (mktgCost / rev) * 100 : null,
            mktgTarget: mktgTargetPct(rev, mi),
            barterPosts: km?.barter ?? 0,
            paidPosts: km?.paid ?? 0,
        }
    })

    const linkSeries = monthList.map((m, i) => ({
        month: m,
        kolPosts: kolByMonth.get(m)?.posts ?? 0,
        revenue: monthlySales.get(m)?.revenue ?? 0,
        revenueLag1:
            i + 1 < monthList.length ? (monthlySales.get(monthList[i + 1])?.revenue ?? 0) : 0,
    }))

    const groupLots = lots
        .filter((l) => skuSet.has(l.sku))
        .sort((a, b) => a.orderDate.localeCompare(b.orderDate))

    return {
        groupId: group.groupId,
        label: group.label,
        skus: group.skus,
        tier,
        asp,
        cogs,
        netMarginPct,
        launchDate,
        monthIndex,
        verdict,
        alerts,
        alertMessages: messages,
        runRate,
        runRateSource: runRateResult.source,
        runRateSourceMonth: runRateResult.sourceMonth,
        runRateTarget: salesTargetForMonth(Math.max(monthIndex, 1)),
        gpTargetPct: GP_TARGET_PCT,
        avgMonthlyRevenue,
        avgMonthlyUnits,
        salesMonthly,
        channelSplit: {
            marketplace: mpRev,
            direct: directRev,
            other: Math.max(0, totalRev - mpRev - directRev),
        },
        currentStock,
        daysCover,
        leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
        seedUnits,
        barterUnits,
        sellableUnits: Math.max(0, currentStock - seedUnits),
        seedCapPct,
        seedCapLimit,
        lots:
            groupLots.length > 0
                ? groupLots
                : currentStock > 0
                  ? [
                        {
                            lotNo: "Current",
                            qtyOrdered: currentStock,
                            orderDate: launchDate ?? "",
                            arrivalDate: launchDate ?? "",
                            sku: group.skus[0],
                        },
                    ]
                  : [],
        kolMonthly,
        cumulativeKolCost,
        cumulativeNetGp: totalNetGp,
        gpPerKol,
        barterRecommendation,
        barterOppCostPerUnit,
        linkSeries,
        monthlyTable,
        kolPostsPerMonth: postsAllTotal,
        kolBarterPerMonth: postsAllBarter,
        kolPaidPerMonth: postsAllPaid,
        kolPostsMonthLabel: postsAllTotal > 0 ? "ทั้งหมด" : "",
        mktgCostPeriod: periodMktgCost,
        mktgPctPeriod: periodMktgPct,
        mktgTargetPeriod: mktgTarget,
        runRateMonthRev,
    }
}

async function fetchLaunchDataDirect() {
    const [salesRaw, costRaw, kolRaw, stockRaw, masterRaw, launchedRaw, productsRaw] =
        await Promise.all([
        readTab("sales_orders"),
        readTab("po_costs"),
        readTab("KOL"),
        readTab("Stock_AT"),
        readTab("product_master").catch(() => [] as Record<string, string>[]),
        readTab("launched_products"),
        readTab("products").catch(() => [] as Record<string, string>[]),
    ])

    const { lots } = parseStockLots(stockRaw)
    const launchedProducts = parseLaunchedProducts(launchedRaw)
    return {
        sales: parseSales(salesRaw),
        costs: parseCosts(costRaw),
        kolPosts: parseKolPosts(kolRaw),
        lots,
        master: parseProductMaster(masterRaw),
        launchDates: parseLaunched(launchedRaw),
        launchedProducts,
        products: parseProductsGoLive(productsRaw),
        loadedAt: new Date().toISOString(),
    }
}

const getCachedLaunchData = unstable_cache(
    fetchLaunchDataDirect,
    // v5: stock qty read fresh in loadLaunchCommandCenter (not from cache)
    ["launch-command-center-raw-v5"],
    { revalidate: 1800, tags: ["analytics-data", "launch-command-center"] },
)

export async function loadLaunchCommandCenter(
    selectedGroupId?: string,
): Promise<LaunchCommandCenterData> {
    let raw
    try {
        raw = await getCachedLaunchData()
    } catch {
        raw = await fetchLaunchDataDirect()
    }

    // Fresh Stock_AT read every time (Current Stock must not come from cache)
    const stockRaw = await readTab("Stock_AT")
    const stockBySku = toStockQtyMap(buildStockQtyRecord(stockRaw))
    const launchDates = new Map(Object.entries(raw.launchDates ?? {}))

    const costMap = new Map(raw.costs.map((c) => [c.sku.toUpperCase(), c]))
    const cohortYear = new Date().getFullYear()
    const newLaunchSkuSet = buildNewLaunchSkuSetForYear(
        raw.launchedProducts,
        raw.products,
        cohortYear,
    )

    const newSkus = [...newLaunchSkuSet].filter((sku) => {
        const hasSales = raw.sales.some((s) => s.sku.toUpperCase() === sku && isValidSale(s))
        const hasCost = costMap.has(sku)
        const hasKol = raw.kolPosts.some((p) => p.sku === sku)
        return hasSales || hasCost || hasKol
    })

    const groupsBuilt = buildGroups(newSkus, raw.master, raw.costs, raw.sales)
    const details = groupsBuilt.map((g) =>
        computeGroupDetail(
            g,
            raw.sales,
            raw.kolPosts,
            stockBySku,
            raw.lots,
            costMap,
            launchDates,
        ),
    )

    const groups: ProductGroupOption[] = details.map((d) => ({
        groupId: d.groupId,
        label: d.label,
        skus: d.skus,
        tier: d.tier,
        asp: d.asp,
        netMarginPct: d.netMarginPct,
        verdict: d.verdict,
    }))

    const progressGoalOverrides = await loadProgressGoalOverrides().catch(() => new Map<string, number>())
    const { rollup, rows, alerts, scatter } = buildPortfolio(details, progressGoalOverrides)

    const selected =
        selectedGroupId && groups.some((g) => g.groupId === selectedGroupId)
            ? (details.find((d) => d.groupId === selectedGroupId) ?? null)
            : null

    if (details.length === 0) throw new Error("No New 2026 product groups found")

    return {
        dataAsOf: raw.loadedAt,
        groups,
        portfolio: rollup,
        portfolioRows: rows,
        portfolioAlerts: alerts,
        scatterData: scatter,
        selected,
    }
}
