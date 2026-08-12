"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ComposedChart,
} from "recharts"
import {
    ArrowLeft,
    Rocket,
    TrendingUp,
    TrendingDown,
    Minus,
    Calendar,
} from "lucide-react"
import { differenceInCalendarMonths, parseISO, isValid as isValidDate } from "date-fns"
import { classifyOrderChannel } from "@/lib/sales/channel"
import {
    COHORT_2025_SKU_SET,
    COHORT_2025_SKUS,
    buildCohort2026SkuSet,
    earliestLaunchDate,
    type LaunchedProductRow,
} from "@/lib/sales/cohort"

interface SalesOrderRow {
    order_date: string
    order_id: string
    channel_raw: string
    marketplace_name: string
    integration_name: string
    sku: string
    product_name: string
    quantity: string | number
    line_total: string | number
}

interface Product {
    sku_code: string
    product_name: string
    category: string
    sub_category: string
}

interface PoCost {
    sku: string
    weighted_avg_cost: string | number
}

interface PeriodStats {
    revenue: number
    units: number
    netGp: number
    orders: Set<string>
    skuCount: number
}

function toNum(v: unknown): number {
    if (typeof v === "number") return v
    if (!v) return 0
    return Number(String(v).replace(/,/g, "")) || 0
}

function fmtThb(n: number, digits = 0): string {
    return `฿${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`
}

function fmtPct(n: number, digits = 1): string {
    if (!isFinite(n)) return "—"
    const sign = n > 0 ? "+" : ""
    return `${sign}${n.toFixed(digits)}%`
}

function growthPct(base: number, cmp: number): number | null {
    if (base === 0 && cmp === 0) return 0
    if (base === 0) return null // "new"
    return ((cmp - base) / Math.abs(base)) * 100
}

function todayYmd(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function emptyStats(skuCount: number): PeriodStats {
    return { revenue: 0, units: 0, netGp: 0, orders: new Set(), skuCount }
}

export function CohortGrowthDashboard({
    salesOrders,
    launchedProducts,
    products,
    poCosts,
}: {
    salesOrders: SalesOrderRow[]
    launchedProducts: LaunchedProductRow[]
    products: Product[]
    poCosts: PoCost[]
}) {
    const today = todayYmd()
    const currentYear = new Date().getFullYear()
    const priorYear = currentYear - 1
    const ytdPriorEnd = `${priorYear}-${today.slice(5)}`

    const cohort2026Set = useMemo(
        () => buildCohort2026SkuSet(launchedProducts),
        [launchedProducts],
    )

    const cohort2026Skus = useMemo(() => [...cohort2026Set].sort(), [cohort2026Set])

    const productMap = useMemo(() => {
        const m = new Map<string, Product>()
        products.forEach((p) => m.set(p.sku_code, p))
        return m
    }, [products])

    const costMap = useMemo(() => {
        const m = new Map<string, number>()
        poCosts.forEach((c) => m.set(String(c.sku ?? "").trim(), toNum(c.weighted_avg_cost)))
        return m
    }, [poCosts])

    const nameMap = useMemo(() => {
        const m = new Map<string, string>()
        launchedProducts.forEach((lp) => m.set(lp.zort_sku, lp.product_name))
        products.forEach((p) => m.set(p.sku_code, p.product_name))
        return m
    }, [launchedProducts, products])

    // Cohort anchor dates for "months since launch" ramp comparison
    const anchor2025 = useMemo(() => {
        const fromLaunch = earliestLaunchDate(launchedProducts, COHORT_2025_SKU_SET)
        return fromLaunch ?? `${priorYear}-01-01`
    }, [launchedProducts, priorYear])

    const anchor2026 = useMemo(() => {
        const fromLaunch = earliestLaunchDate(launchedProducts, cohort2026Set)
        return fromLaunch ?? `${currentYear}-01-01`
    }, [launchedProducts, cohort2026Set, currentYear])

    const enriched = useMemo(() => {
        return salesOrders
            .map((row) => {
                const sku = String(row.sku ?? "").trim()
                const cohort =
                    COHORT_2025_SKU_SET.has(sku) ? "2025" : cohort2026Set.has(sku) ? "2026" : null
                if (!cohort) return null

                const orderDate = row.order_date?.slice(0, 10)
                if (!orderDate) return null
                const date = parseISO(orderDate)
                if (!isValidDate(date)) return null

                const qty = toNum(row.quantity)
                const revenue = toNum(row.line_total)
                const unitCost = costMap.get(sku) ?? 0
                const channel = classifyOrderChannel(
                    row.channel_raw,
                    row.marketplace_name,
                    row.integration_name,
                )
                const netGp = revenue * (1 - channel.deduction) - qty * unitCost

                const anchor = cohort === "2025" ? anchor2025 : anchor2026
                const monthIndex = Math.max(
                    0,
                    differenceInCalendarMonths(date, parseISO(anchor)),
                )

                return {
                    cohort,
                    sku,
                    product_name: row.product_name || nameMap.get(sku) || sku,
                    order_date: orderDate,
                    order_id: row.order_id,
                    quantity: qty,
                    revenue,
                    netGp,
                    monthIndex,
                }
            })
            .filter(Boolean) as Array<{
            cohort: "2025" | "2026"
            sku: string
            product_name: string
            order_date: string
            order_id: string
            quantity: number
            revenue: number
            netGp: number
            monthIndex: number
        }>
    }, [salesOrders, cohort2026Set, costMap, nameMap, anchor2025, anchor2026])

    // ─── YTD same calendar window (Jan 1 → today each year) ─────────────────
    const ytdComparison = useMemo(() => {
        const agg = (cohort: "2025" | "2026", yearStart: string, yearEnd: string) => {
            const skuSet = cohort === "2025" ? COHORT_2025_SKU_SET : cohort2026Set
            const rows = enriched.filter(
                (r) =>
                    r.cohort === cohort &&
                    r.order_date >= yearStart &&
                    r.order_date <= yearEnd,
            )
            const stats = emptyStats(skuSet.size)
            rows.forEach((r) => {
                stats.revenue += r.revenue
                stats.units += r.quantity
                stats.netGp += r.netGp
                if (r.order_id) stats.orders.add(r.order_id)
            })
            return { ...stats, orderCount: stats.orders.size }
        }

        const prior = agg("2025", `${priorYear}-01-01`, ytdPriorEnd)
        const current = agg("2026", `${currentYear}-01-01`, today)

        return {
            prior,
            current,
            revGrowth: growthPct(prior.revenue, current.revenue),
            gpGrowth: growthPct(prior.netGp, current.netGp),
            unitsGrowth: growthPct(prior.units, current.units),
        }
    }, [enriched, cohort2026Set, priorYear, currentYear, today, ytdPriorEnd])

    // ─── Months-since-launch ramp (fair apples-to-apples) ───────────────────
    const rampData = useMemo(() => {
        const maxMonth = Math.max(
            ...enriched.map((r) => r.monthIndex),
            0,
        )
        const capped = Math.min(maxMonth, 12)
        const points = []
        let cum25 = 0
        let cum26 = 0
        let cumGp25 = 0
        let cumGp26 = 0

        for (let m = 0; m <= capped; m++) {
            const m25 = enriched.filter((r) => r.cohort === "2025" && r.monthIndex === m)
            const m26 = enriched.filter((r) => r.cohort === "2026" && r.monthIndex === m)
            const rev25 = m25.reduce((s, r) => s + r.revenue, 0)
            const rev26 = m26.reduce((s, r) => s + r.revenue, 0)
            const gp25 = m25.reduce((s, r) => s + r.netGp, 0)
            const gp26 = m26.reduce((s, r) => s + r.netGp, 0)
            cum25 += rev25
            cum26 += rev26
            cumGp25 += gp25
            cumGp26 += gp26
            points.push({
                month: `M+${m}`,
                monthIndex: m,
                rev2025: rev25,
                rev2026: rev26,
                cumRev2025: cum25,
                cumRev2026: cum26,
                cumGp2025: cumGp25,
                cumGp2026: cumGp26,
            })
        }
        return points
    }, [enriched])

    // Growth at latest comparable month (both cohorts have started)
    const latestComparableMonth = useMemo(() => {
        const months26 = new Set(
            enriched.filter((r) => r.cohort === "2026").map((r) => r.monthIndex),
        )
        let best = 0
        for (const m of months26) {
            const has25 = enriched.some((r) => r.cohort === "2025" && r.monthIndex === m)
            if (has25) best = Math.max(best, m)
        }
        return best
    }, [enriched])

    const rampAtComparable = useMemo(() => {
        const pt = rampData.find((p) => p.monthIndex === latestComparableMonth)
        if (!pt) return null
        return {
            month: latestComparableMonth,
            cumRev2025: pt.cumRev2025,
            cumRev2026: pt.cumRev2026,
            cumGp2025: pt.cumGp2025,
            cumGp2026: pt.cumGp2026,
            revGrowth: growthPct(pt.cumRev2025, pt.cumRev2026),
            gpGrowth: growthPct(pt.cumGp2025, pt.cumGp2026),
        }
    }, [rampData, latestComparableMonth])

    // Per-SKU stats for each cohort (YTD current year vs YTD prior year for 2025 SKUs)
    const skuRows = useMemo(() => {
        const build = (sku: string, cohort: "2025" | "2026") => {
            const rows = enriched.filter((r) => r.sku === sku)
            const ytdPrior = rows.filter(
                (r) => r.order_date >= `${priorYear}-01-01` && r.order_date <= ytdPriorEnd,
            )
            const ytdCurrent = rows.filter(
                (r) => r.order_date >= `${currentYear}-01-01` && r.order_date <= today,
            )
            const sum = (arr: typeof rows) => ({
                revenue: arr.reduce((s, r) => s + r.revenue, 0),
                units: arr.reduce((s, r) => s + r.quantity, 0),
                netGp: arr.reduce((s, r) => s + r.netGp, 0),
            })
            const p = sum(ytdPrior)
            const c = sum(ytdCurrent)
            const pInfo = productMap.get(sku)
            const lp = launchedProducts.find((x) => x.zort_sku === sku)
            return {
                sku,
                cohort,
                product_name: nameMap.get(sku) || sku,
                category: pInfo?.category ?? "—",
                launch_date: lp?.launch_date?.slice(0, 10) ?? "—",
                ytdPrior: p,
                ytdCurrent: c,
                revGrowth: growthPct(p.revenue, c.revenue),
            }
        }

        const rows2025 = COHORT_2025_SKUS.map((sku) => build(sku, "2025"))
        const rows2026 = cohort2026Skus.map((sku) => build(sku, "2026"))
        return { rows2025, rows2026 }
    }, [
        enriched,
        cohort2026Skus,
        productMap,
        nameMap,
        launchedProducts,
        priorYear,
        currentYear,
        today,
        ytdPriorEnd,
    ])

    if (salesOrders.length === 0) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center">
                <p className="text-muted-foreground">
                    No sales_orders data yet. Run order sync first, then reload.
                </p>
                <Link href="/dashboard/sales" className="text-sm underline mt-4 inline-block">
                    Back to Sales
                </Link>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 w-full py-2 text-foreground">
            <div>
                <Link
                    href="/dashboard/sales"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Sales
                </Link>
                <h1 className="text-3xl font-bold tracking-tight mt-2 flex items-center gap-2">
                    <Rocket className="w-7 h-7 text-emerald-600" />
                    New Product Cohort — {priorYear} vs {currentYear}
                </h1>
                <p className="text-muted-foreground mt-1 max-w-3xl">
                    เปรียบเทียบ portfolio สินค้าใหม่ปีที่แล้ว ({COHORT_2025_SKUS.length} SKU) กับ
                    สินค้าที่ launch ใหม่ปีนี้ ({cohort2026Skus.length} SKU) — ดูอัตราเติบโต
                    ทั้งช่วงเวลาเดียวกัน (YTD) และช่วงเทียบจากวัน launch (M+0, M+1, …)
                </p>
            </div>

            {/* Cohort identity cards */}
            <div className="grid gap-4 md:grid-cols-2">
                <CohortIdentityCard
                    year={priorYear}
                    skuCount={COHORT_2025_SKUS.length}
                    anchor={anchor2025}
                    accent="border-slate-300 bg-slate-50"
                    badgeClass="bg-slate-600 text-white"
                    description="สินค้าใหม่ที่ launch / ขายเป็นหลักในปี 2025"
                />
                <CohortIdentityCard
                    year={currentYear}
                    skuCount={cohort2026Skus.length}
                    anchor={anchor2026}
                    accent="border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/50"
                    badgeClass="bg-emerald-600 text-white"
                    description="สินค้า NEW_LAUNCH จาก launched_products ปี 2026"
                />
            </div>

            {/* YTD headline comparison */}
            <Card className="border-emerald-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" /> YTD เปรียบเทียบช่วงเดียวกัน
                    </CardTitle>
                    <CardDescription>
                        {priorYear} cohort (Jan 1 → {ytdPriorEnd.slice(5)}) vs {currentYear} cohort
                        (Jan 1 → {today.slice(5)}) — วัดว่าปีนี้ portfolio ใหม่เติบโตเร็วกว่าปีที่แล้ว
                        ในช่วงเวลาเท่ากันหรือไม่
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <CompareKpi
                            label="Revenue"
                            prior={fmtThb(ytdComparison.prior.revenue)}
                            current={fmtThb(ytdComparison.current.revenue)}
                            growth={ytdComparison.revGrowth}
                            priorLabel={`${priorYear} cohort YTD`}
                            currentLabel={`${currentYear} cohort YTD`}
                        />
                        <CompareKpi
                            label="Net GP"
                            prior={fmtThb(ytdComparison.prior.netGp)}
                            current={fmtThb(ytdComparison.current.netGp)}
                            growth={ytdComparison.gpGrowth}
                            priorLabel={`${priorYear} cohort YTD`}
                            currentLabel={`${currentYear} cohort YTD`}
                        />
                        <CompareKpi
                            label="Units sold"
                            prior={ytdComparison.prior.units.toLocaleString()}
                            current={ytdComparison.current.units.toLocaleString()}
                            growth={ytdComparison.unitsGrowth}
                            priorLabel={`${priorYear} cohort YTD`}
                            currentLabel={`${currentYear} cohort YTD`}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Ramp comparison at same month-since-launch */}
            {rampAtComparable && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            เติบโตเทียบช่วง launch เท่ากัน — สะสมถึง M+{rampAtComparable.month}
                        </CardTitle>
                        <CardDescription>
                            {priorYear} cohort เริ่ม {anchor2025} · {currentYear} cohort เริ่ม{" "}
                            {anchor2026} — เปรียบ cumulative revenue/GP หลัง launch เท่ากัน
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <CompareKpi
                                label="Cumulative revenue"
                                prior={fmtThb(rampAtComparable.cumRev2025)}
                                current={fmtThb(rampAtComparable.cumRev2026)}
                                growth={rampAtComparable.revGrowth}
                                priorLabel={`${priorYear} ที่ M+${rampAtComparable.month}`}
                                currentLabel={`${currentYear} ที่ M+${rampAtComparable.month}`}
                            />
                            <CompareKpi
                                label="Cumulative Net GP"
                                prior={fmtThb(rampAtComparable.cumGp2025)}
                                current={fmtThb(rampAtComparable.cumGp2026)}
                                growth={rampAtComparable.gpGrowth}
                                priorLabel={`${priorYear} ที่ M+${rampAtComparable.month}`}
                                currentLabel={`${currentYear} ที่ M+${rampAtComparable.month}`}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Ramp charts */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Cumulative revenue — months since launch</CardTitle>
                        <CardDescription>
                            เส้นสะสมหลัง launch: {priorYear} (เทา) vs {currentYear} (เขียว)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={rampData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(v) =>
                                        Math.abs(v) >= 1_000_000
                                            ? `${(v / 1_000_000).toFixed(1)}M`
                                            : `${(v / 1_000).toFixed(0)}K`
                                    }
                                />
                                <Tooltip formatter={(v) => fmtThb(Number(v ?? 0))} />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="cumRev2025"
                                    name={`${priorYear} cohort`}
                                    stroke="#94a3b8"
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="cumRev2026"
                                    name={`${currentYear} cohort`}
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Monthly revenue by cohort</CardTitle>
                        <CardDescription>รายเดือนหลัง launch (ไม่สะสม)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={rampData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickFormatter={(v) =>
                                        Math.abs(v) >= 1_000_000
                                            ? `${(v / 1_000_000).toFixed(1)}M`
                                            : `${(v / 1_000).toFixed(0)}K`
                                    }
                                />
                                <Tooltip formatter={(v) => fmtThb(Number(v ?? 0))} />
                                <Legend />
                                <Bar
                                    dataKey="rev2025"
                                    name={`${priorYear} cohort`}
                                    fill="#cbd5e1"
                                    barSize={18}
                                />
                                <Bar
                                    dataKey="rev2026"
                                    name={`${currentYear} cohort`}
                                    fill="#10b981"
                                    barSize={18}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Per-SKU tables */}
            <div className="grid gap-6 md:grid-cols-2">
                <SkuTable
                    title={`${priorYear} cohort — ${COHORT_2025_SKUS.length} SKUs`}
                    description={`YTD ${priorYear} vs YTD ${currentYear} ต่อ SKU`}
                    rows={skuRows.rows2025}
                    priorYear={priorYear}
                    currentYear={currentYear}
                />
                <SkuTable
                    title={`${currentYear} cohort — ${cohort2026Skus.length} SKUs (NEW_LAUNCH)`}
                    description={`YTD ${priorYear} vs YTD ${currentYear} ต่อ SKU`}
                    rows={skuRows.rows2026}
                    priorYear={priorYear}
                    currentYear={currentYear}
                />
            </div>

            {/* Insight footer */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">สรุป & action</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2 pt-0">
                    <InsightLine
                        growth={ytdComparison.revGrowth}
                        metric="revenue YTD"
                        priorYear={priorYear}
                        currentYear={currentYear}
                    />
                    <InsightLine
                        growth={ytdComparison.gpGrowth}
                        metric="Net GP YTD"
                        priorYear={priorYear}
                        currentYear={currentYear}
                    />
                    {rampAtComparable?.revGrowth != null && isFinite(rampAtComparable.revGrowth) && (
                        <p>
                            • ที่ช่วง launch เท่ากัน (M+{rampAtComparable.month}): {currentYear}{" "}
                            cohort ทำ revenue สะสม{" "}
                            {fmtPct(rampAtComparable.revGrowth)} กว่า {priorYear} cohort
                            {rampAtComparable.revGrowth > 0
                                ? " — portfolio ใหม่ปีนี้ ramp เร็วกว่า 🟢"
                                : rampAtComparable.revGrowth < -10
                                  ? " — ต้องเร่ง marketing/pricing 🟠"
                                  : " — ใกล้เคียงปีที่แล้ว 🟡"}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function CohortIdentityCard({
    year,
    skuCount,
    anchor,
    accent,
    badgeClass,
    description,
}: {
    year: number
    skuCount: number
    anchor: string
    accent: string
    badgeClass: string
    description: string
}) {
    return (
        <Card className={accent}>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{year} New Product Cohort</CardTitle>
                    <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                    >
                        {skuCount} SKUs
                    </span>
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
                <span className="text-muted-foreground">Launch anchor: </span>
                <span className="font-medium">{anchor}</span>
            </CardContent>
        </Card>
    )
}

function CompareKpi({
    label,
    prior,
    current,
    growth,
    priorLabel,
    currentLabel,
}: {
    label: string
    prior: string
    current: string
    growth: number | null
    priorLabel: string
    currentLabel: string
}) {
    const positive = growth !== null && growth > 0
    const negative = growth !== null && growth < 0
    return (
        <div className="rounded-lg border bg-background p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold">{current}</div>
            <div className="text-xs text-muted-foreground">{currentLabel}</div>
            <div className="text-xs text-muted-foreground mt-2">
                vs {prior} ({priorLabel})
            </div>
            <div
                className={`mt-2 text-sm font-semibold inline-flex items-center gap-1 ${
                    positive ? "text-emerald-700" : negative ? "text-red-600" : "text-muted-foreground"
                }`}
            >
                {growth === null ? (
                    <>new portfolio</>
                ) : positive ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                ) : negative ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                    <Minus className="w-3.5 h-3.5" />
                )}
                {growth === null ? null : fmtPct(growth)} YoY
            </div>
        </div>
    )
}

function SkuTable({
    title,
    description,
    rows,
    priorYear,
    currentYear,
}: {
    title: string
    description: string
    rows: Array<{
        sku: string
        product_name: string
        launch_date: string
        ytdPrior: { revenue: number; units: number; netGp: number }
        ytdCurrent: { revenue: number; units: number; netGp: number }
        revGrowth: number | null
    }>
    priorYear: number
    currentYear: number
}) {
    const sorted = [...rows].sort((a, b) => b.ytdCurrent.revenue - a.ytdCurrent.revenue)
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-x-auto max-h-[480px] overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/30 sticky top-0">
                            <tr>
                                <th className="h-9 px-2 text-left font-medium text-muted-foreground">
                                    Product
                                </th>
                                <th className="h-9 px-2 text-right font-medium text-muted-foreground">
                                    {priorYear} YTD
                                </th>
                                <th className="h-9 px-2 text-right font-medium text-muted-foreground">
                                    {currentYear} YTD
                                </th>
                                <th className="h-9 px-2 text-right font-medium text-muted-foreground">
                                    Growth
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r) => (
                                <tr key={r.sku} className="border-b hover:bg-muted/40">
                                    <td className="p-2 align-middle">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-xs leading-tight">
                                                {r.product_name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {r.sku}
                                                {r.launch_date !== "—" && ` · ${r.launch_date}`}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-2 align-middle text-right text-muted-foreground text-xs">
                                        {fmtThb(r.ytdPrior.revenue)}
                                    </td>
                                    <td className="p-2 align-middle text-right text-xs font-medium">
                                        {fmtThb(r.ytdCurrent.revenue)}
                                    </td>
                                    <td
                                        className={`p-2 align-middle text-right text-xs font-semibold ${
                                            r.revGrowth === null
                                                ? "text-emerald-700"
                                                : r.revGrowth > 0
                                                  ? "text-emerald-700"
                                                  : r.revGrowth < 0
                                                    ? "text-red-600"
                                                    : ""
                                        }`}
                                    >
                                        {r.revGrowth === null ? "new" : fmtPct(r.revGrowth)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}

function InsightLine({
    growth,
    metric,
    priorYear,
    currentYear,
}: {
    growth: number | null
    metric: string
    priorYear: number
    currentYear: number
}) {
    if (growth === null) {
        return (
            <p>
                • {currentYear} cohort {metric}: ไม่มี baseline {priorYear} — portfolio ใหม่ทั้งชุด
            </p>
        )
    }
    const verb =
        growth > 10 ? "สูงกว่า" : growth < -10 ? "ต่ำกว่า" : "ใกล้เคียง"
    return (
        <p>
            • {currentYear} cohort {metric}{" "}
            <strong className={growth > 0 ? "text-emerald-700" : growth < 0 ? "text-red-600" : ""}>
                {fmtPct(growth)}
            </strong>{" "}
            vs {priorYear} cohort ในช่วง YTD เดียวกัน — {verb} portfolio ปีที่แล้ว
        </p>
    )
}
