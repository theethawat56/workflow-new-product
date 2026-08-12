"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { Cohort, ProductDeepDiveData } from "@/lib/analytics/types"
import { DEFAULT_LEAD_TIME, Z_BY_SERVICE, stockStatus } from "@/lib/analytics/constants"
import { VERDICT_META } from "@/lib/analytics/rule-engine"
import { fmtNum, fmtPct, fmtPctRaw, fmtThb } from "@/lib/analytics/format"
import { cn } from "@/lib/utils"
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    ReferenceLine,
} from "recharts"
import { ArrowDown, ArrowUp } from "lucide-react"

const COHORT_LABEL: Record<Cohort, string> = {
    NEW_2026: "New 2026",
    NEW_2025: "New 2025",
    CORE: "Core",
}

const COHORT_STYLE: Record<Cohort, string> = {
    NEW_2026: "bg-emerald-100 text-emerald-800 border-emerald-200",
    NEW_2025: "bg-sky-100 text-sky-800 border-sky-200",
    CORE: "bg-muted text-muted-foreground",
}

const STATUS_STYLE = {
    "REORDER NOW": "bg-red-100 text-red-800 border-red-300",
    WATCH: "bg-amber-100 text-amber-800 border-amber-300",
    OK: "bg-emerald-100 text-emerald-800 border-emerald-300",
    UNKNOWN: "bg-muted text-muted-foreground",
} as const

export function ProductDeepDiveDashboard({ data }: { data: ProductDeepDiveData }) {
    const [leadTime, setLeadTime] = useState(DEFAULT_LEAD_TIME)
    const [serviceLevel, setServiceLevel] = useState<90 | 95 | 99>(90)
    const [stockInput, setStockInput] = useState(
        data.stock.currentStock != null ? String(data.stock.currentStock) : "",
    )

    const z = Z_BY_SERVICE[serviceLevel]
    const stock = useMemo(() => {
        const dailyStd = data.stock.dailyStd
        const ropDailyAvg = data.stock.ropDailyAvg
        const safetyStock = z * dailyStd * Math.sqrt(leadTime)
        const reorderPoint = ropDailyAvg * leadTime + safetyStock
        const minOrderQty = ropDailyAvg * leadTime
        const parsed =
            stockInput === "" ? data.stock.currentStock : Number(stockInput)
        const currentStock =
            parsed != null && !Number.isNaN(parsed) ? parsed : null
        const coverDays =
            currentStock != null && ropDailyAvg > 0
                ? currentStock / ropDailyAvg
                : null
        return {
            safetyStock,
            reorderPoint,
            minOrderQty,
            currentStock,
            coverDays,
            status: stockStatus(currentStock, reorderPoint),
        }
    }, [data.stock, leadTime, z, stockInput])

    const verdictMeta = VERDICT_META[data.verdict]

    return (
        <div className="space-y-4 w-full">
            {/* A. Header strip */}
            <div className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">{data.productName}</h1>
                        <p className="font-mono text-sm text-muted-foreground mt-1">
                            {data.sku}
                        </p>
                    </div>
                    <Badge
                        variant="outline"
                        className={cn("text-sm py-1", verdictMeta.className)}
                    >
                        {verdictMeta.emoji} {verdictMeta.label} — {verdictMeta.labelTh}
                    </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={COHORT_STYLE[data.cohort]}>
                        {COHORT_LABEL[data.cohort]}
                    </Badge>
                    <Badge variant="outline">{data.seasonality}</Badge>
                    <span className="text-xs text-muted-foreground self-center">
                        Data as of {data.dataAsOf}
                    </span>
                </div>
                <p className="text-sm border-l-4 border-primary/40 pl-3 text-muted-foreground">
                    {data.verdictReason}
                </p>
            </div>

            {/* B. KPI cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <KpiCard
                    title="Revenue"
                    value={fmtThb(data.ytd2026.revenue)}
                    delta={data.ytdDelta.revenuePct}
                    isNew={!data.ytdDelta.hasPriorYear}
                />
                <KpiCard
                    title="Units"
                    value={fmtNum(data.ytd2026.units)}
                    delta={data.ytdDelta.unitsPct}
                    isNew={!data.ytdDelta.hasPriorYear}
                />
                <KpiCard
                    title="Avg sell"
                    value={
                        data.ytd2026.avgSellPrice != null
                            ? fmtThb(data.ytd2026.avgSellPrice)
                            : "—"
                    }
                    isNew={!data.ytdDelta.hasPriorYear}
                />
                <KpiCard
                    title="GM%"
                    value={
                        data.ytd2026.grossMarginPct != null
                            ? fmtPctRaw(data.ytd2026.grossMarginPct)
                            : "—"
                    }
                    delta={data.ytdDelta.grossMarginPctDelta}
                    deltaIsPp
                    isNew={!data.ytdDelta.hasPriorYear}
                />
                <KpiCard
                    title="Gross profit"
                    value={fmtThb(data.ytd2026.grossProfit)}
                    delta={data.ytdDelta.grossProfitPct}
                    isNew={!data.ytdDelta.hasPriorYear}
                />
                <KpiCard
                    title="Orders"
                    value={fmtNum(data.ytd2026.orders)}
                    isNew={!data.ytdDelta.hasPriorYear}
                />
            </div>
            <p className="text-xs text-muted-foreground -mt-3">
                YTD {data.ytd2026From} → {data.ytd2026To} vs {data.ytd2025From} →{" "}
                {data.ytd2025To} · GM% after channel deductions (Mkt −32% / Direct −19%)
            </p>

            {/* C. Trend chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Monthly trend (18 months)</CardTitle>
                    <CardDescription>
                        Units + revenue · 3-month MA on units
                        {data.firstSaleMonth && (
                            <> · First sale: {data.firstSaleMonth}</>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data.monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 10 }}
                                tickFormatter={(m) => m.slice(5)}
                            />
                            <YAxis
                                yAxisId="units"
                                tick={{ fontSize: 10 }}
                                width={40}
                            />
                            <YAxis
                                yAxisId="rev"
                                orientation="right"
                                tick={{ fontSize: 10 }}
                                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                width={48}
                            />
                            <Tooltip
                                formatter={(v, name) =>
                                    name === "revenue"
                                        ? fmtThb(Number(v ?? 0))
                                        : fmtNum(Number(v ?? 0))
                                }
                            />
                            <Legend />
                            <Bar
                                yAxisId="units"
                                dataKey="units"
                                name="Units"
                                fill="#6366f1"
                                radius={2}
                            />
                            <Line
                                yAxisId="units"
                                type="monotone"
                                dataKey="unitsMa3"
                                name="Units MA3"
                                stroke="#f59e0b"
                                dot={false}
                                strokeWidth={2}
                            />
                            <Line
                                yAxisId="rev"
                                type="monotone"
                                dataKey="revenue"
                                name="Revenue"
                                stroke="#10b981"
                                dot={false}
                                strokeWidth={2}
                            />
                            {data.firstSaleMonth && (
                                <ReferenceLine
                                    x={data.firstSaleMonth}
                                    stroke="#ef4444"
                                    strokeDasharray="4 4"
                                    label={{ value: "Launch", fontSize: 10 }}
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* D. Channel breakdown */}
            <Card>
                <CardHeader>
                    <CardTitle>Channel breakdown</CardTitle>
                    <CardDescription>{data.channelInsight}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                            Revenue share
                        </p>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data.channelBreakdown}
                                    layout="vertical"
                                    margin={{ left: 100 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        type="number"
                                        tickFormatter={(v) => fmtThb(v)}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="group"
                                        width={95}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <Tooltip
                                        formatter={(v, name) =>
                                            name === "share"
                                                ? `${Number(v).toFixed(1)}%`
                                                : fmtThb(Number(v ?? 0))
                                        }
                                    />
                                    <Bar dataKey="revenue" fill="#0ea5e9" radius={4} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                            GM% by channel
                        </p>
                        <div className="h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data.channelBreakdown.filter(
                                        (c) => c.gmPct != null,
                                    )}
                                    layout="vertical"
                                    margin={{ left: 100 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={["auto", "auto"]} />
                                    <YAxis
                                        type="category"
                                        dataKey="group"
                                        width={95}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <Tooltip formatter={(v) => fmtPctRaw(Number(v))} />
                                    <Bar dataKey="gmPct" fill="#10b981" radius={4} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* E. Velocity & stock */}
            <Card>
                <CardHeader>
                    <CardTitle>Velocity & stock</CardTitle>
                    <CardDescription>
                        ROP from {data.stock.velocityAccelerating ? "30d" : "90d"} velocity
                        · Stock_AT default
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {data.stock.velocityAccelerating && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            ⏫ เร่งตัว — velocity 30 วัน สูงกว่า 90 วัน &gt;50% · ใช้ค่าล่าสุดสำหรับ ROP
                        </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Metric label="daily_avg 30d" value={fmtNum(data.stock.dailyAvg30, 2)} />
                        <Metric label="daily_avg 60d" value={fmtNum(data.stock.dailyAvg60, 2)} />
                        <Metric label="daily_avg 90d" value={fmtNum(data.stock.dailyAvg90, 2)} />
                        <Metric label="σ (90d)" value={fmtNum(data.stock.dailyStd, 2)} />
                        <Metric label="Safety stock" value={fmtNum(stock.safetyStock, 0)} />
                        <Metric label="ROP" value={fmtNum(stock.reorderPoint, 0)} bold />
                        <Metric label="Min order qty" value={fmtNum(stock.minOrderQty, 0)} />
                        <Metric
                            label="Cover days"
                            value={
                                stock.coverDays != null
                                    ? fmtNum(stock.coverDays, 1)
                                    : "—"
                            }
                        />
                    </div>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div>
                            <Label className="text-xs">Current stock</Label>
                            <Input
                                type="number"
                                className="w-28 mt-1"
                                value={stockInput}
                                onChange={(e) => setStockInput(e.target.value)}
                                placeholder="จาก Stock_AT"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Lead time (days)</Label>
                            <Input
                                type="number"
                                className="w-24 mt-1"
                                value={leadTime}
                                onChange={(e) =>
                                    setLeadTime(Number(e.target.value) || 45)
                                }
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Service level</Label>
                            <Select
                                value={String(serviceLevel)}
                                onValueChange={(v) =>
                                    setServiceLevel(Number(v) as 90 | 95 | 99)
                                }
                            >
                                <SelectTrigger className="w-32 mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="90">90% (Z=1.28)</SelectItem>
                                    <SelectItem value="95">95% (Z=1.65)</SelectItem>
                                    <SelectItem value="99">99% (Z=2.33)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Badge
                            variant="outline"
                            className={STATUS_STYLE[stock.status]}
                        >
                            {stock.status}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* F. Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>ต้องทำอะไรต่อ</CardTitle>
                    <CardDescription>
                        Auto-generated from rule engine · median cohort units ={" "}
                        {fmtNum(data.medianUnits)}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc pl-5 space-y-2 text-sm">
                        {data.actions.map((a, i) => (
                            <li key={i}>{a}</li>
                        ))}
                    </ul>
                    <div className="flex gap-3 mt-4 text-sm">
                        <Link
                            href={`/analytics/data?sku=${encodeURIComponent(data.sku)}`}
                            className="underline text-muted-foreground"
                        >
                            ดู raw rows →
                        </Link>
                        <Link
                            href="/analytics/stock"
                            className="underline text-muted-foreground"
                        >
                            Stock dashboard →
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function KpiCard({
    title,
    value,
    delta,
    deltaIsPp,
    isNew,
}: {
    title: string
    value: string
    delta?: number | null
    deltaIsPp?: boolean
    isNew?: boolean
}) {
    return (
        <Card>
            <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-lg font-bold">{value}</div>
                {isNew ? (
                    <Badge variant="outline" className="mt-1 text-[10px]">
                        ใหม่ปีนี้
                    </Badge>
                ) : delta != null ? (
                    <span
                        className={cn(
                            "text-xs flex items-center gap-0.5 mt-1",
                            delta >= 0 ? "text-emerald-600" : "text-red-600",
                        )}
                    >
                        {delta >= 0 ? (
                            <ArrowUp className="w-3 h-3" />
                        ) : (
                            <ArrowDown className="w-3 h-3" />
                        )}
                        {deltaIsPp
                            ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pp`
                            : fmtPct(delta)}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground mt-1">—</span>
                )}
            </CardContent>
        </Card>
    )
}

function Metric({
    label,
    value,
    bold,
}: {
    label: string
    value: string
    bold?: boolean
}) {
    return (
        <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
            <p className={cn("text-lg tabular-nums", bold && "font-bold")}>
                {value}
            </p>
        </div>
    )
}
