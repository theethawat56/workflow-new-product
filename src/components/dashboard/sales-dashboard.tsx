"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Cell,
} from "recharts"
import {
    ShoppingCart,
    DollarSign,
    Rocket,
    Filter,
    Calendar as CalendarIcon,
    Search,
    X,
    Coins,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    RefreshCw,
    Info,
} from "lucide-react"
import {
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    subDays,
    subMonths,
    subYears,
    isWithinInterval,
    isValid,
    differenceInCalendarMonths,
    differenceInCalendarDays,
    format,
} from "date-fns"

// ─────────────────────────────────────────────────────────────────────────────
//  Domain types
// ─────────────────────────────────────────────────────────────────────────────
import {
    classifyOrderChannel,
    DEDUCTION_LABELS,
    DIRECT_DEDUCTION,
    MARKETPLACE_DEDUCTION,
} from "@/lib/sales/channel"
import { isMainSku, isNewLaunchProduct } from "@/lib/sales/cohort"
import Link from "next/link"
import { SkuLink } from "@/components/analytics/SkuLink"

interface SalesOrderRow {
    row_id: string
    order_id: string
    order_number: string
    order_date: string
    success_date: string
    status: string
    payment_status: string
    channel_raw: string
    marketplace_name: string
    integration_name: string
    sku: string
    product_name: string
    is_bundle: string | number
    quantity: string | number
    unit_price: string | number
    unit_price_pretax: string | number
    line_total: string | number
    line_total_pretax: string | number
    line_discount: string | number
    synced_at: string
}

interface LaunchedProduct {
    zort_sku: string
    launch_date: string
    product_name: string
    status: string
    launch_type?: string // NEW_LAUNCH | EXISTING_ADDITION
}

interface Product {
    product_id: string
    sku_code: string
    product_name: string
    category: string
    sub_category: string
    sales_channel?: string
    go_live_date: string
}

interface PoCost {
    sku: string
    product_name: string
    total_qty: string | number
    total_value_pretax: string | number
    weighted_avg_cost: string | number
    latest_po_date: string
    earliest_po_date: string
    po_count: string | number
    synced_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
function toNum(v: unknown): number {
    if (typeof v === "number") return v
    if (!v) return 0
    return Number(String(v).replace(/,/g, "")) || 0
}

function fmtThb(n: number, digits = 0): string {
    return `฿${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`
}

function fmtPct(n: number, digits = 1): string {
    return `${n.toFixed(digits)}%`
}

// Color a margin cell green / yellow / red based on health bands.
function marginClass(pct: number): string {
    if (!isFinite(pct)) return "text-muted-foreground"
    if (pct < 0) return "text-red-600 font-semibold"
    if (pct < 10) return "text-orange-600"
    if (pct < 20) return "text-yellow-700"
    return "text-emerald-700 font-medium"
}

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────
export function SalesDashboard({
    salesOrders,
    launchedProducts,
    products,
    poCosts,
}: {
    salesOrders: SalesOrderRow[]
    launchedProducts: LaunchedProduct[]
    products: Product[]
    poCosts: PoCost[]
}) {
    // ─── Filters ──────────────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState("ALL") // ALL | NEW | EXISTING
    const [categoryFilter, setCategoryFilter] = useState("ALL")
    const [subCategoryFilter, setSubCategoryFilter] = useState("ALL")
    const [channelFilter, setChannelFilter] = useState("ALL")
    const [periodFilter, setPeriodFilter] = useState("THIS_YEAR")
    const [customFrom, setCustomFrom] = useState("")
    const [customTo, setCustomTo] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    // Default ON — `Sale_All` historically included ~600 accessory / dump SKUs
    // that diluted every chart. We only want branded products (ATB*, EU0*).
    const [mainSkuOnly, setMainSkuOnly] = useState(true)
    const [syncing, setSyncing] = useState<null | "costs" | "orders">(null)
    const [syncMessage, setSyncMessage] = useState<string | null>(null)

    const currentYear = new Date().getFullYear()

    const lastCostSyncAt = useMemo(() => {
        const ts = poCosts
            .map((r) => r.synced_at)
            .filter((s) => typeof s === "string" && s.length > 0)
            .sort()
            .pop()
        return ts ?? null
    }, [poCosts])

    const lastOrderSyncAt = useMemo(() => {
        const ts = (salesOrders as SalesOrderRow[])
            .map((r) => r.synced_at)
            .filter((s): s is string => typeof s === "string" && s.length > 0)
            .sort()
            .pop()
        return ts ?? null
    }, [salesOrders])

    async function handleSyncCosts() {
        setSyncing("costs")
        setSyncMessage(null)
        try {
            const res = await fetch("/api/integrations/zortout/sync-po-costs", { method: "POST" })
            const json = await res.json()
            if (!res.ok || !json.ok) {
                setSyncMessage(`Cost sync failed: ${json.error ?? res.statusText}`)
            } else {
                setSyncMessage(
                    `✓ Synced ${json.stats?.uniqueSkus ?? "?"} SKUs in ${(
                        (json.elapsedMs ?? 0) / 1000
                    ).toFixed(1)}s — reload to see updated costs.`,
                )
            }
        } catch (e) {
            setSyncMessage(`Cost sync failed: ${(e as Error).message}`)
        } finally {
            setSyncing(null)
        }
    }

    async function handleSyncOrders() {
        setSyncing("orders")
        setSyncMessage(null)
        try {
            const res = await fetch(
                "/api/integrations/zortout/sync-orders?mode=delta&days=3",
                { method: "POST" },
            )
            const json = await res.json()
            if (!res.ok || !json.ok) {
                setSyncMessage(`Order sync failed: ${json.error ?? res.statusText}`)
            } else {
                setSyncMessage(
                    `✓ Synced last 3 days: ${json.stats?.rows ?? "?"} rows (` +
                        `updated=${json.stats?.updated ?? 0}, new=${json.stats?.appended ?? 0}) ` +
                        `in ${((json.elapsedMs ?? 0) / 1000).toFixed(1)}s — reload to see.`,
                )
            }
        } catch (e) {
            setSyncMessage(`Order sync failed: ${(e as Error).message}`)
        } finally {
            setSyncing(null)
        }
    }

    // ─── 1. Join orders + product + launched + cost into one enriched row ────
    //
    // Each `sales_orders` row is already one *line item* (one SKU within one
    // order). We just need to look up product metadata, cost basis, and apply
    // the channel-specific deduction rate to produce Net GP.
    //
    const enriched = useMemo(() => {
        const productMap = new Map<string, Product>()
        products.forEach((p) => productMap.set(p.sku_code, p))

        const launchedMap = new Map<string, LaunchedProduct>()
        launchedProducts.forEach((p) => launchedMap.set(p.zort_sku, p))

        const costMap = new Map<string, number>()
        poCosts.forEach((c) => {
            const sku = String(c.sku ?? "").trim()
            const cost = toNum(c.weighted_avg_cost)
            if (sku) costMap.set(sku, cost)
        })

        return salesOrders
            .map((row) => {
                const sku = String(row.sku ?? "").trim()
                const product = productMap.get(sku)
                const launchedInfo = launchedMap.get(sku)

                const isNew = isNewLaunchProduct(
                    product?.go_live_date,
                    launchedInfo,
                    currentYear,
                )

                const date = new Date(row.order_date)
                const quantity = toNum(row.quantity)
                const revenue = toNum(row.line_total) // incl VAT — gross top-line

                const unitCost = costMap.get(sku) ?? 0
                const cogs = quantity * unitCost

                // Per-order channel — this is the big upgrade over the old
                // `sales_all` data source: we know the actual channel for THIS
                // specific transaction instead of guessing from the product
                // metadata.
                const channel = classifyOrderChannel(
                    row.channel_raw,
                    row.marketplace_name,
                    row.integration_name,
                )
                const netRevenue = revenue * (1 - channel.deduction)
                const netGp = netRevenue - cogs
                const gpMargin = revenue > 0 ? (netGp / revenue) * 100 : 0
                const gpPerUnit = quantity > 0 ? netGp / quantity : 0

                return {
                    order_id: row.order_id,
                    row_id: row.row_id,
                    order_date: row.order_date,
                    sku,
                    product_name: row.product_name || product?.product_name || sku,
                    quantity,
                    revenue,
                    date,
                    isNewProduct: isNew,
                    category: product?.category || "Uncategorized",
                    sub_category: product?.sub_category || "Uncategorized",
                    product_id: product?.product_id,
                    order_status: row.status,
                    channel_label: channel.channel,
                    channel_category: channel.category,
                    deduction_rate: channel.deduction,
                    unit_cost: unitCost,
                    cogs,
                    net_revenue: netRevenue,
                    net_gp: netGp,
                    gp_margin: gpMargin,
                    gp_per_unit: gpPerUnit,
                    has_cost: unitCost > 0,
                }
            })
            .filter((item) => isValid(item.date))
    }, [salesOrders, products, launchedProducts, poCosts, currentYear])

    // ─── 2. Period interval ──────────────────────────────────────────────────
    const interval = useMemo(() => {
        const now = new Date()
        switch (periodFilter) {
            case "TODAY":
                return { start: startOfDay(now), end: endOfDay(now) }
            case "YESTERDAY": {
                const y = subDays(now, 1)
                return { start: startOfDay(y), end: endOfDay(y) }
            }
            case "THIS_WEEK":
                return {
                    start: startOfWeek(now, { weekStartsOn: 1 }),
                    end: endOfWeek(now, { weekStartsOn: 1 }),
                }
            case "LAST_WEEK": {
                const lw = subDays(now, 7)
                return {
                    start: startOfWeek(lw, { weekStartsOn: 1 }),
                    end: endOfWeek(lw, { weekStartsOn: 1 }),
                }
            }
            case "THIS_MONTH":
                return { start: startOfMonth(now), end: endOfMonth(now) }
            case "LAST_MONTH": {
                const lm = subMonths(now, 1)
                return { start: startOfMonth(lm), end: endOfMonth(lm) }
            }
            case "THIS_YEAR":
                return { start: startOfYear(now), end: endOfYear(now) }
            case "LAST_YEAR": {
                const ly = subYears(now, 1)
                return { start: startOfYear(ly), end: endOfYear(ly) }
            }
            case "LAST_30_DAYS":
                return { start: subDays(now, 30), end: now }
            case "LAST_90_DAYS":
                return { start: subDays(now, 90), end: now }
            case "CUSTOM": {
                // Custom date-to-date range from the two date pickers
                const from = customFrom ? new Date(customFrom) : null
                const to = customTo ? new Date(customTo) : null
                if (from && to && isValid(from) && isValid(to)) {
                    // Allow either order; clamp to full days
                    const lo = from <= to ? from : to
                    const hi = from <= to ? to : from
                    return { start: startOfDay(lo), end: endOfDay(hi) }
                }
                return null
            }
            case "ALL":
                return null
            default: {
                // Specific month: "MONTH:2026-06"
                if (periodFilter.startsWith("MONTH:")) {
                    const ym = periodFilter.slice(6)
                    const [y, m] = ym.split("-").map(Number)
                    if (y && m) {
                        const d = new Date(y, m - 1, 1)
                        return { start: startOfMonth(d), end: endOfMonth(d) }
                    }
                }
                return null
            }
        }
    }, [periodFilter, customFrom, customTo])

    // ─── 3. Apply filters ────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        return enriched.filter((item) => {
            if (mainSkuOnly && !isMainSku(item.sku)) return false
            if (interval && !isWithinInterval(item.date, interval)) return false
            if (statusFilter === "NEW" && !item.isNewProduct) return false
            if (statusFilter === "EXISTING" && item.isNewProduct) return false
            if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false
            if (subCategoryFilter !== "ALL" && item.sub_category !== subCategoryFilter) return false
            if (channelFilter !== "ALL" && item.channel_category !== channelFilter) return false
            return true
        })
    }, [enriched, interval, statusFilter, categoryFilter, subCategoryFilter, channelFilter, mainSkuOnly])

    // Effective period length in months (min 1) — used for "/ month" KPIs.
    const periodMonths = useMemo(() => {
        if (!interval) {
            // ALL — use actual span of filtered data
            if (filtered.length === 0) return 1
            const dates = filtered.map((r) => r.date.getTime())
            const min = new Date(Math.min(...dates))
            const max = new Date(Math.max(...dates))
            return Math.max(differenceInCalendarMonths(max, min), 1)
        }
        const days = Math.max(differenceInCalendarDays(interval.end, interval.start) + 1, 1)
        return Math.max(days / 30, 1)
    }, [interval, filtered])

    // ─── 4. Aggregate KPIs ───────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const sum = (sel: (r: (typeof filtered)[number]) => number) =>
            filtered.reduce((s, r) => s + sel(r), 0)

        const totalRevenue = sum((r) => r.revenue)
        const totalCogs = sum((r) => r.cogs)
        const totalNetRevenue = sum((r) => r.net_revenue)
        const totalNetGp = sum((r) => r.net_gp)
        const grossMargin = totalRevenue > 0 ? (totalNetGp / totalRevenue) * 100 : 0
        const orders = new Set(filtered.map((r) => r.order_id)).size
        const skusWithoutCost = new Set(
            filtered.filter((r) => !r.has_cost).map((r) => r.sku),
        ).size
        const revenueWithoutCost = filtered
            .filter((r) => !r.has_cost)
            .reduce((s, r) => s + r.revenue, 0)

        return {
            totalRevenue,
            totalCogs,
            totalNetRevenue,
            totalNetGp,
            grossMargin,
            netGpPerMonth: totalNetGp / periodMonths,
            orders,
            skusWithoutCost,
            revenueWithoutCost,
        }
    }, [filtered, periodMonths])

    // ─── 5. New vs Existing comparison ────────────────────────────────────────
    const comparison = useMemo(() => {
        const make = (isNew: boolean) => {
            const rows = filtered.filter((r) => r.isNewProduct === isNew)
            const rev = rows.reduce((s, r) => s + r.revenue, 0)
            const cogs = rows.reduce((s, r) => s + r.cogs, 0)
            const netGp = rows.reduce((s, r) => s + r.net_gp, 0)
            const uniqueSkus = new Set(rows.map((r) => r.sku)).size
            const units = rows.reduce((s, r) => s + r.quantity, 0)
            return {
                revenue: rev,
                cogs,
                netGp,
                margin: rev > 0 ? (netGp / rev) * 100 : 0,
                gpPerMonth: netGp / periodMonths,
                uniqueSkus,
                units,
                arpu: uniqueSkus > 0 ? rev / uniqueSkus : 0,
                gpPerSku: uniqueSkus > 0 ? netGp / uniqueSkus : 0,
            }
        }
        return { newProducts: make(true), existing: make(false) }
    }, [filtered, periodMonths])

    // ─── Channel breakdown (per-order data makes this honest now) ───────────
    const channelBreakdown = useMemo(() => {
        const acc = new Map<
            string,
            {
                channel: string
                category: string
                deduction: number
                orders: Set<string>
                units: number
                revenue: number
                cogs: number
                netGp: number
            }
        >()
        filtered.forEach((r) => {
            const key = `${r.channel_category}|${r.channel_label}`
            const cur = acc.get(key)
            if (!cur) {
                acc.set(key, {
                    channel: r.channel_label,
                    category: r.channel_category,
                    deduction: r.deduction_rate,
                    orders: new Set([r.order_id]),
                    units: r.quantity,
                    revenue: r.revenue,
                    cogs: r.cogs,
                    netGp: r.net_gp,
                })
            } else {
                cur.orders.add(r.order_id)
                cur.units += r.quantity
                cur.revenue += r.revenue
                cur.cogs += r.cogs
                cur.netGp += r.net_gp
            }
        })
        return [...acc.values()]
            .map((c) => ({
                ...c,
                orderCount: c.orders.size,
                margin: c.revenue > 0 ? (c.netGp / c.revenue) * 100 : 0,
            }))
            .sort((a, b) => b.netGp - a.netGp)
    }, [filtered])

    // ─── 6. Monthly GP trend ─────────────────────────────────────────────────
    const monthlyTrend = useMemo(() => {
        const bucket: Record<
            string,
            { month: string; new_gp: number; existing_gp: number; new_rev: number; existing_rev: number }
        > = {}
        filtered.forEach((r) => {
            const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, "0")}`
            if (!bucket[key]) {
                bucket[key] = { month: key, new_gp: 0, existing_gp: 0, new_rev: 0, existing_rev: 0 }
            }
            if (r.isNewProduct) {
                bucket[key].new_gp += r.net_gp
                bucket[key].new_rev += r.revenue
            } else {
                bucket[key].existing_gp += r.net_gp
                bucket[key].existing_rev += r.revenue
            }
        })
        return Object.values(bucket).sort((a, b) => a.month.localeCompare(b.month))
    }, [filtered])

    // ─── 7. Per-SKU performance ──────────────────────────────────────────────
    const skuPerformance = useMemo(() => {
        const acc = new Map<
            string,
            {
                sku: string
                name: string
                category: string
                sub_category: string
                channel_label: string
                deduction_rate: number
                unit_cost: number
                isNew: boolean
                units: number
                revenue: number
                cogs: number
                net_revenue: number
                net_gp: number
            }
        >()
        filtered.forEach((r) => {
            const cur = acc.get(r.sku)
            if (!cur) {
                acc.set(r.sku, {
                    sku: r.sku,
                    name: r.product_name,
                    category: r.category,
                    sub_category: r.sub_category,
                    channel_label: r.channel_label,
                    deduction_rate: r.deduction_rate,
                    unit_cost: r.unit_cost,
                    isNew: r.isNewProduct,
                    units: r.quantity,
                    revenue: r.revenue,
                    cogs: r.cogs,
                    net_revenue: r.net_revenue,
                    net_gp: r.net_gp,
                })
            } else {
                cur.units += r.quantity
                cur.revenue += r.revenue
                cur.cogs += r.cogs
                cur.net_revenue += r.net_revenue
                cur.net_gp += r.net_gp
            }
        })
        return [...acc.values()]
            .map((r) => ({
                ...r,
                gp_margin: r.revenue > 0 ? (r.net_gp / r.revenue) * 100 : 0,
                gp_per_unit: r.units > 0 ? r.net_gp / r.units : 0,
            }))
            .sort((a, b) => b.net_gp - a.net_gp)
    }, [filtered])

    // ─── 8. Insight panels (top earners / negative margin alerts) ───────────
    const topGpEarners = useMemo(() => skuPerformance.slice(0, 5), [skuPerformance])
    const negativeMarginAlerts = useMemo(
        () =>
            skuPerformance
                .filter((r) => r.gp_margin < 0 && r.revenue > 0 && r.unit_cost > 0)
                .sort((a, b) => a.gp_margin - b.gp_margin)
                .slice(0, 5),
        [skuPerformance],
    )

    // ─── 9. Filter options ───────────────────────────────────────────────────
    // Distinct months present in the data → "MONTH:yyyy-MM" options (newest first)
    const monthOptions = useMemo<[string, string][]>(() => {
        const keys = new Set<string>()
        enriched.forEach((d) => {
            if (isValid(d.date)) keys.add(format(d.date, "yyyy-MM"))
        })
        return Array.from(keys)
            .sort()
            .reverse()
            .map((ym) => {
                const [y, m] = ym.split("-").map(Number)
                const label = format(new Date(y, m - 1, 1), "MMM yyyy")
                return [`MONTH:${ym}`, label] as [string, string]
            })
    }, [enriched])

    const categories = Array.from(new Set(enriched.map((d) => d.category))).sort()
    const subCategories = Array.from(
        new Set(
            enriched
                .filter((d) => categoryFilter === "ALL" || d.category === categoryFilter)
                .map((d) => d.sub_category),
        ),
    ).sort()

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-4 w-full py-2 text-foreground">
            <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sales & Profitability</h1>
                    <p className="text-muted-foreground mt-1">
                        Net GP analysis — compare new vs existing products, identify pricing actions
                    </p>
                    <Link
                        href="/dashboard/cohort-growth"
                        className="inline-flex items-center gap-1.5 mt-3 text-sm text-emerald-700 hover:text-emerald-900 underline-offset-4 hover:underline"
                    >
                        <Rocket className="w-3.5 h-3.5" />
                        See 2025 vs 2026 cohort growth →
                    </Link>
                    <Link
                        href="/dashboard/cohort-growth"
                        className="inline-flex items-center gap-1.5 mt-3 text-sm text-emerald-700 hover:text-emerald-900 underline-offset-4 hover:underline"
                    >
                        <Rocket className="w-3.5 h-3.5" />
                        See 2025 cohort YoY growth →
                    </Link>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSyncOrders}
                            disabled={syncing !== null}
                            className="gap-2"
                        >
                            <RefreshCw
                                className={`w-3.5 h-3.5 ${syncing === "orders" ? "animate-spin" : ""}`}
                            />
                            {syncing === "orders" ? "Syncing orders…" : "Refresh orders (3d)"}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSyncCosts}
                            disabled={syncing !== null}
                            className="gap-2"
                        >
                            <RefreshCw
                                className={`w-3.5 h-3.5 ${syncing === "costs" ? "animate-spin" : ""}`}
                            />
                            {syncing === "costs" ? "Syncing PO costs…" : "Refresh PO costs"}
                        </Button>
                    </div>
                    <div className="text-xs text-muted-foreground text-right space-y-0.5">
                        <div>
                            Orders source: <strong>sales_orders</strong> (Zort) · auto every 4h ·{" "}
                            {lastOrderSyncAt
                                ? `last sync ${new Date(lastOrderSyncAt).toLocaleString("th-TH")}`
                                : "not yet synced"}
                        </div>
                        <div>
                            Cost basis: weighted avg ex-VAT ·{" "}
                            {lastCostSyncAt
                                ? `last sync ${new Date(lastCostSyncAt).toLocaleString("th-TH")}`
                                : "not yet synced"}
                        </div>
                    </div>
                    {syncMessage && (
                        <span className="text-xs text-emerald-700 max-w-md text-right">
                            {syncMessage}
                        </span>
                    )}
                </div>
            </div>

            {/* Deduction-model banner */}
            <div className="rounded-lg border bg-muted/30 p-3 text-xs flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Info className="w-3.5 h-3.5" />
                    Net GP deductions per channel:
                </span>
                <span>{DEDUCTION_LABELS.MARKETPLACE}</span>
                <span>{DEDUCTION_LABELS.DIRECT}</span>
                <span className="text-muted-foreground">
                    Per-order channel from Zort —{" "}
                    {Math.round(MARKETPLACE_DEDUCTION * 100)}% marketplace /{" "}
                    {Math.round(DIRECT_DEDUCTION * 100)}% direct applied per line
                </span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 p-4 bg-muted/20 rounded-lg border items-end">
                <FilterSelect
                    icon={<CalendarIcon className="w-3 h-3" />}
                    label="Period"
                    value={periodFilter}
                    onChange={setPeriodFilter}
                    options={[
                        ["TODAY", "Today"],
                        ["YESTERDAY", "Yesterday"],
                        ["THIS_WEEK", "This Week"],
                        ["LAST_WEEK", "Last Week"],
                        ["THIS_MONTH", "This Month"],
                        ["LAST_MONTH", "Last Month"],
                        ["THIS_YEAR", "This Year (YTD)"],
                        ["LAST_YEAR", "Last Year"],
                        ["LAST_30_DAYS", "Last 30 Days"],
                        ["LAST_90_DAYS", "Last 90 Days"],
                        ["ALL", "All Time"],
                        ["CUSTOM", "Custom range (date → date)"],
                        ...monthOptions,
                    ]}
                    groupLabel={monthOptions.length > 0 ? "By month" : undefined}
                    groupFromValue="MONTH:"
                />
                {periodFilter === "CUSTOM" && (
                    <div className="space-y-2">
                        <span className="text-sm font-medium flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            Date range
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={customFrom}
                                max={customTo || undefined}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="h-9 rounded-md border bg-background px-2 text-sm"
                            />
                            <span className="text-muted-foreground text-sm">→</span>
                            <input
                                type="date"
                                value={customTo}
                                min={customFrom || undefined}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="h-9 rounded-md border bg-background px-2 text-sm"
                            />
                        </div>
                        {(!customFrom || !customTo) && (
                            <p className="text-xs text-muted-foreground">
                                เลือกวันเริ่มและวันสิ้นสุด — ถ้ายังไม่ครบจะแสดงทั้งหมด
                            </p>
                        )}
                    </div>
                )}
                <FilterSelect
                    icon={<Filter className="w-3 h-3" />}
                    label="Status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                        ["ALL", "All Products"],
                        ["NEW", `New (${currentYear})`],
                        ["EXISTING", "Existing Catalog"],
                    ]}
                />
                <FilterSelect
                    label="Channel"
                    value={channelFilter}
                    onChange={setChannelFilter}
                    options={[
                        ["ALL", "All Channels"],
                        ["MARKETPLACE", "Marketplace (Shopee/Lazada/TikTok)"],
                        ["DIRECT", "Direct (Line/POS/Online)"],
                        ["OTHER", "Service / Claim / Review"],
                    ]}
                />
                <FilterSelect
                    label="Category"
                    value={categoryFilter}
                    onChange={(v) => {
                        setCategoryFilter(v)
                        setSubCategoryFilter("ALL")
                    }}
                    options={[["ALL", "All Categories"], ...categories.map((c) => [c, c] as [string, string])]}
                />
                <FilterSelect
                    label="Sub-Category"
                    value={subCategoryFilter}
                    onChange={setSubCategoryFilter}
                    options={[
                        ["ALL", "All Sub-Categories"],
                        ...subCategories.map((c) => [c, c] as [string, string]),
                    ]}
                />
                <div className="space-y-2">
                    <span className="text-sm font-medium flex items-center gap-1">
                        <Search className="w-3 h-3" /> Search
                    </span>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Name or SKU…"
                            className="h-10 w-[200px] rounded-md border border-input bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-medium">SKU scope</span>
                    <Button
                        variant={mainSkuOnly ? "default" : "outline"}
                        size="sm"
                        className="h-10 w-[180px] justify-start"
                        onClick={() => setMainSkuOnly(!mainSkuOnly)}
                    >
                        <Filter className="w-3.5 h-3.5 mr-2" />
                        {mainSkuOnly ? "Main SKUs only" : "All SKUs"}
                    </Button>
                </div>
                <div className="ml-auto text-sm text-muted-foreground pb-2 self-end">
                    {filtered.length.toLocaleString()} sales rows · {skuPerformance.length} SKUs
                    {mainSkuOnly && (
                        <span className="ml-2 text-xs italic">
                            (filtered to ATB / EU branded SKUs)
                        </span>
                    )}
                </div>
            </div>

            {/* Data-quality warning if some sales rows have no cost basis */}
            {kpis.skusWithoutCost > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>
                        <strong>{kpis.skusWithoutCost}</strong> SKU(s) totalling{" "}
                        <strong>{fmtThb(kpis.revenueWithoutCost)}</strong> revenue have no PO cost
                        on record — Net GP is understated. Add purchase orders in Zort or click
                        Refresh PO costs.
                    </span>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <KpiCard
                    title="Revenue (gross)"
                    value={fmtThb(kpis.totalRevenue)}
                    sub={`${kpis.orders.toLocaleString()} order rows`}
                    icon={<DollarSign className="h-4 w-4 text-green-600" />}
                />
                <KpiCard
                    title="Net Revenue"
                    value={fmtThb(kpis.totalNetRevenue)}
                    sub="after VAT + commission + shipping"
                    icon={<Coins className="h-4 w-4 text-blue-600" />}
                />
                <KpiCard
                    title="Net Gross Profit"
                    value={fmtThb(kpis.totalNetGp)}
                    sub={`Margin ${fmtPct(kpis.grossMargin)} of revenue`}
                    icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
                    accent={
                        kpis.totalNetGp < 0
                            ? "text-red-600"
                            : kpis.grossMargin >= 20
                              ? "text-emerald-700"
                              : "text-orange-600"
                    }
                />
                <KpiCard
                    title="Net GP / month"
                    value={fmtThb(kpis.netGpPerMonth)}
                    sub={`over ~${periodMonths.toFixed(1)} months`}
                    icon={<ShoppingCart className="h-4 w-4 text-purple-600" />}
                />
            </div>

            {/* New vs Existing comparison — new products always shown first
                and styled with the emerald hero treatment so the eye lands on
                them. Existing catalog is muted but kept for context. */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                    <ComparisonCard
                        title={`🚀 New ${currentYear} launches`}
                        accent="bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-300 shadow-sm"
                        badgeClass="bg-emerald-600 text-white"
                        data={comparison.newProducts}
                    />
                </div>
                <ComparisonCard
                    title="Existing catalog"
                    accent="bg-slate-50 border-slate-200"
                    badgeClass="bg-slate-600 text-white"
                    data={comparison.existing}
                />
            </div>

            {/* Monthly GP Trend */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-600" /> Monthly Net GP Trend
                    </CardTitle>
                    <CardDescription>
                        Net gross profit (after channel deductions and cost) — split by new vs
                        existing. Bars show monthly revenue.
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis
                                yAxisId="left"
                                tick={{ fontSize: 11 }}
                                tickFormatter={(v) =>
                                    Math.abs(v) >= 1_000_000
                                        ? `${(v / 1_000_000).toFixed(1)}M`
                                        : Math.abs(v) >= 1_000
                                          ? `${(v / 1_000).toFixed(0)}K`
                                          : v
                                }
                            />
                            <Tooltip formatter={(v: any) => fmtThb(Number(v))} />
                            <Legend />
                            <Bar
                                yAxisId="left"
                                dataKey="existing_rev"
                                stackId="rev"
                                name="Revenue (Existing)"
                                fill="#cbd5e1"
                                barSize={26}
                            />
                            <Bar
                                yAxisId="left"
                                dataKey="new_rev"
                                stackId="rev"
                                name="Revenue (New)"
                                fill="#a7f3d0"
                                barSize={26}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="existing_gp"
                                name="Net GP (Existing)"
                                stroke="#475569"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="new_gp"
                                name="Net GP (New)"
                                stroke="#10b981"
                                strokeWidth={3}
                                dot={{ r: 4 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Channel breakdown (per-order data) */}
            <Card>
                <CardHeader>
                    <CardTitle>Channel Performance</CardTitle>
                    <CardDescription>
                        Per-order channel from Zort — actual deduction rate applied per
                        transaction (no more channel guessing).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-muted/30">
                                <tr>
                                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">
                                        Channel
                                    </th>
                                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">
                                        Category
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Orders
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Units
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Revenue
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Deduction
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Net GP
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Margin
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {channelBreakdown.map((c) => (
                                    <tr key={`${c.category}-${c.channel}`} className="border-b hover:bg-muted/40">
                                        <td className="p-3 align-middle font-medium">
                                            {c.channel}
                                        </td>
                                        <td className="p-3 align-middle">
                                            <span
                                                className={
                                                    c.category === "MARKETPLACE"
                                                        ? "inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-semibold"
                                                        : c.category === "DIRECT"
                                                          ? "inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold"
                                                          : "inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs font-semibold"
                                                }
                                            >
                                                {c.category}
                                            </span>
                                        </td>
                                        <td className="p-3 align-middle text-right">
                                            {c.orderCount.toLocaleString()}
                                        </td>
                                        <td className="p-3 align-middle text-right">
                                            {c.units.toLocaleString(undefined, {
                                                maximumFractionDigits: 0,
                                            })}
                                        </td>
                                        <td className="p-3 align-middle text-right">
                                            {fmtThb(c.revenue)}
                                        </td>
                                        <td className="p-3 align-middle text-right text-muted-foreground">
                                            −{fmtPct(c.deduction * 100, 0)}
                                        </td>
                                        <td
                                            className={`p-3 align-middle text-right font-semibold ${
                                                c.netGp < 0 ? "text-red-600" : ""
                                            }`}
                                        >
                                            {fmtThb(c.netGp)}
                                        </td>
                                        <td
                                            className={`p-3 align-middle text-right ${marginClass(c.margin)}`}
                                        >
                                            {fmtPct(c.margin)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Top GP Earners + Negative Margin Alerts */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-600" /> Top 5 GP earners
                        </CardTitle>
                        <CardDescription>
                            Highest net GP — protect these. Where to invest marketing budget.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <InsightTable rows={topGpEarners} kind="top" />
                    </CardContent>
                </Card>
                <Card className={negativeMarginAlerts.length === 0 ? "" : "border-red-300"}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-red-600" /> Negative margin alerts
                        </CardTitle>
                        <CardDescription>
                            Selling these at a loss — repricing, sourcing renegotiation, or sunset.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {negativeMarginAlerts.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-6 text-center">
                                ✓ No SKUs are bleeding margin in this period.
                            </p>
                        ) : (
                            <InsightTable rows={negativeMarginAlerts} kind="negative" />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Categories by GP */}
            <Card>
                <CardHeader>
                    <CardTitle>Net GP by Category</CardTitle>
                    <CardDescription>
                        Where the profit actually lives — not the same as revenue ranking.
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={categoryGpData(skuPerformance)}
                            margin={{ left: 100 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                tickFormatter={(v) =>
                                    Math.abs(v) >= 1_000_000
                                        ? `${(v / 1_000_000).toFixed(1)}M`
                                        : `${(v / 1_000).toFixed(0)}K`
                                }
                                tick={{ fontSize: 11 }}
                            />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                tick={{ fontSize: 11 }}
                            />
                            <Tooltip formatter={(v: any) => fmtThb(Number(v))} />
                            <Bar dataKey="net_gp" name="Net GP">
                                {categoryGpData(skuPerformance).map((row, i) => (
                                    <Cell
                                        key={i}
                                        fill={row.net_gp >= 0 ? "#10b981" : "#ef4444"}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Detailed Product Performance Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Product Performance</CardTitle>
                    <CardDescription>
                        {searchQuery
                            ? `Searching "${searchQuery}" — ${skuPerformance.filter((p) => matchSearch(p, searchQuery)).length} result(s)`
                            : `Sorted by Net GP · ${skuPerformance.length} SKUs · color-coded by margin band`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-muted/30">
                                <tr>
                                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">
                                        Product / SKU
                                    </th>
                                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">
                                        Channel
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Units
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Revenue
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Unit Cost
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        COGS
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Net Rev
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Net GP
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        Margin
                                    </th>
                                    <th className="h-10 px-3 text-right font-medium text-muted-foreground">
                                        GP / unit
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {skuPerformance
                                    .filter((p) => matchSearch(p, searchQuery))
                                    .slice(0, 300)
                                    .map((p) => (
                                        <tr key={p.sku} className="border-b hover:bg-muted/40">
                                            <td className="p-3 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="flex items-center gap-2 font-medium">
                                                        {p.name}
                                                        {p.isNew && (
                                                            <span className="inline-flex items-center rounded-full border-transparent bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold">
                                                                New
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        <SkuLink sku={p.sku} /> · {p.category} / {p.sub_category}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 align-middle">
                                                <div className="flex flex-col">
                                                    <span>{p.channel_label}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        −{fmtPct(p.deduction_rate * 100, 0)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 align-middle text-right">
                                                {p.units.toLocaleString(undefined, {
                                                    maximumFractionDigits: 0,
                                                })}
                                            </td>
                                            <td className="p-3 align-middle text-right">
                                                {fmtThb(p.revenue)}
                                            </td>
                                            <td className="p-3 align-middle text-right">
                                                {p.unit_cost > 0 ? (
                                                    fmtThb(p.unit_cost, 0)
                                                ) : (
                                                    <span className="text-amber-600">no PO</span>
                                                )}
                                            </td>
                                            <td className="p-3 align-middle text-right text-muted-foreground">
                                                {fmtThb(p.cogs)}
                                            </td>
                                            <td className="p-3 align-middle text-right">
                                                {fmtThb(p.net_revenue)}
                                            </td>
                                            <td
                                                className={`p-3 align-middle text-right font-semibold ${
                                                    p.net_gp < 0 ? "text-red-600" : ""
                                                }`}
                                            >
                                                {fmtThb(p.net_gp)}
                                            </td>
                                            <td
                                                className={`p-3 align-middle text-right ${marginClass(p.gp_margin)}`}
                                            >
                                                {fmtPct(p.gp_margin)}
                                            </td>
                                            <td className="p-3 align-middle text-right">
                                                {fmtThb(p.gp_per_unit, 0)}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                    {skuPerformance.length > 300 && (
                        <p className="text-xs text-muted-foreground pt-2">
                            Showing first 300 SKUs by Net GP. Use search/filter to narrow.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Filter banner showing what filters are applied — small footer */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Rocket className="w-4 h-4" /> Quick actions
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1.5 pt-0">
                    <p>
                        •{" "}
                        <strong>
                            {comparison.newProducts.uniqueSkus} new SKUs
                        </strong>{" "}
                        contribute {fmtThb(comparison.newProducts.netGp)} GP (margin{" "}
                        {fmtPct(comparison.newProducts.margin)}) vs existing margin{" "}
                        {fmtPct(comparison.existing.margin)}.
                        {comparison.newProducts.margin > comparison.existing.margin
                            ? " 🟢 New launches are over-performing existing in margin — keep launching."
                            : comparison.newProducts.margin < comparison.existing.margin - 5
                              ? " 🟠 New launches are under-performing — re-check pricing / costs."
                              : " 🟡 Performance roughly in line with catalog."}
                    </p>
                    {negativeMarginAlerts.length > 0 && (
                        <p>
                            • <strong className="text-red-600">{negativeMarginAlerts.length} SKUs</strong> are
                            in the red — review the list above and decide reprice / renegotiate / sunset.
                        </p>
                    )}
                    {kpis.skusWithoutCost > 0 && (
                        <p>
                            •{" "}
                            <strong className="text-amber-700">
                                {kpis.skusWithoutCost} SKUs missing cost data
                            </strong>{" "}
                            ({fmtThb(kpis.revenueWithoutCost)} revenue) — sync POs or add the
                            missing SKU costs manually.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FilterSelect({
    icon,
    label,
    value,
    onChange,
    options,
    groupLabel,
    groupFromValue,
}: {
    icon?: React.ReactNode
    label: string
    value: string
    onChange: (v: string) => void
    options: [string, string][]
    /** Optional separator label rendered before the first option matching groupFromValue */
    groupLabel?: string
    groupFromValue?: string
}) {
    return (
        <div className="space-y-2">
            <span className="text-sm font-medium flex items-center gap-1">
                {icon}
                {label}
            </span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                    {options.map(([v, l], i) => {
                        const showGroup =
                            groupLabel &&
                            groupFromValue &&
                            v.startsWith(groupFromValue) &&
                            (i === 0 || !options[i - 1][0].startsWith(groupFromValue))
                        return (
                            <div key={v}>
                                {showGroup && (
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1">
                                        {groupLabel}
                                    </div>
                                )}
                                <SelectItem value={v}>{l}</SelectItem>
                            </div>
                        )
                    })}
                </SelectContent>
            </Select>
        </div>
    )
}

function KpiCard({
    title,
    value,
    sub,
    icon,
    accent,
}: {
    title: string
    value: string
    sub?: string
    icon: React.ReactNode
    accent?: string
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className={`text-2xl font-bold ${accent ?? ""}`}>{value}</div>
                {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </CardContent>
        </Card>
    )
}

function ComparisonCard({
    title,
    accent,
    badgeClass,
    data,
}: {
    title: string
    accent: string
    badgeClass: string
    data: {
        revenue: number
        netGp: number
        margin: number
        gpPerMonth: number
        uniqueSkus: number
        units: number
        gpPerSku: number
    }
}) {
    return (
        <Card className={accent}>
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                    >
                        {data.uniqueSkus} SKUs
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <Stat label="Revenue" value={fmtThb(data.revenue)} />
                    <Stat
                        label="Net GP"
                        value={fmtThb(data.netGp)}
                        accent={
                            data.netGp < 0
                                ? "text-red-600"
                                : data.margin >= 20
                                  ? "text-emerald-700"
                                  : "text-orange-600"
                        }
                    />
                    <Stat
                        label="Margin"
                        value={fmtPct(data.margin)}
                        accent={marginClass(data.margin).split(" ")[0]}
                    />
                    <Stat label="GP / month" value={fmtThb(data.gpPerMonth)} />
                    <Stat label="Units sold" value={data.units.toLocaleString()} />
                    <Stat label="Avg GP / SKU" value={fmtThb(data.gpPerSku)} />
                </div>
            </CardContent>
        </Card>
    )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className={`font-semibold text-base ${accent ?? ""}`}>{value}</div>
        </div>
    )
}

function InsightTable({
    rows,
    kind,
}: {
    rows: Array<{
        sku: string
        name: string
        revenue: number
        net_gp: number
        gp_margin: number
        units: number
        unit_cost: number
    }>
    kind: "top" | "negative"
}) {
    return (
        <table className="w-full text-sm">
            <tbody>
                {rows.map((r) => (
                    <tr key={r.sku} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                            <div className="flex flex-col">
                                <span className="font-medium">{r.name}</span>
                                <span className="text-xs text-muted-foreground">
                                    {r.sku} · {r.units.toLocaleString()} units
                                </span>
                            </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Net GP</span>
                                <span
                                    className={`font-semibold ${
                                        kind === "negative" ? "text-red-600" : "text-emerald-700"
                                    }`}
                                >
                                    {fmtThb(r.net_gp)}
                                </span>
                            </div>
                        </td>
                        <td className="py-2 pl-3 text-right">
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Margin</span>
                                <span className={`font-semibold ${marginClass(r.gp_margin)}`}>
                                    {fmtPct(r.gp_margin)}
                                </span>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function matchSearch(
    p: { sku?: string; name?: string },
    q: string,
): boolean {
    if (!q) return true
    const s = q.toLowerCase()
    return (
        (p.name?.toLowerCase().includes(s) ?? false) ||
        (p.sku?.toLowerCase().includes(s) ?? false)
    )
}

function categoryGpData(
    rows: Array<{ category: string; net_gp: number }>,
): Array<{ name: string; net_gp: number }> {
    const acc = new Map<string, number>()
    rows.forEach((r) => acc.set(r.category, (acc.get(r.category) ?? 0) + r.net_gp))
    return [...acc.entries()]
        .map(([name, net_gp]) => ({ name, net_gp }))
        .sort((a, b) => b.net_gp - a.net_gp)
}
