"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine,
} from "recharts"
import type { AnalyticsOverview } from "@/lib/analytics/types"
import { fmtThb, fmtPct, fmtPctRaw } from "@/lib/analytics/format"
import { AnalyticsGuide } from "@/components/analytics/AnalyticsGuide"
import { ProductStory } from "@/components/analytics/ProductStory"
import { GpPriceChart } from "@/components/analytics/GpPriceChart"
import { SkuLink } from "@/components/analytics/SkuLink"
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"

export function OverviewDashboard({ data }: { data: AnalyticsOverview }) {
    const sharePct = data.newProductSharePct * 100
    const bridgeData = [
        { name: "New 2026", value: data.new2026Rev, fill: "#10b981" },
        { name: "New 2025", value: data.new2025Rev, fill: "#34d399" },
        { name: "Core", value: data.coreRev, fill: "#94a3b8" },
    ]

    const diverging = [
        ...data.topGainers.map((g) => ({
            sku: g.sku,
            label: g.productName.slice(0, 20),
            delta: g.delta,
        })),
        ...data.topDecliners.map((d) => ({
            sku: d.sku,
            label: d.productName.slice(0, 20),
            delta: d.delta,
        })),
    ].sort((a, b) => b.delta - a.delta)

    return (
        <div className="space-y-6">
            <ProductStory data={data} />
            <AnalyticsGuide />
            <p className="text-sm text-muted-foreground">
                Data as of <strong>{data.dataAsOf}</strong> · YTD window{" "}
                {data.ytd2026From} → {data.ytd2026To} vs {data.ytd2025From} →{" "}
                {data.ytd2025To}
                {" · "}
                <Link href="/analytics/data" className="underline">
                    verify in Data Explorer
                </Link>
            </p>

            {data.missingCostSkus.length > 0 && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        {data.missingCostSkus.length} SKUs missing cost data (margin = null):{" "}
                        {data.missingCostSkus.slice(0, 8).join(", ")}
                        {data.missingCostSkus.length > 8 ? "…" : ""}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Kpi
                    title="Total Revenue YTD"
                    value={fmtThb(data.totalRevYtd2026)}
                    sub={
                        <span className="flex items-center gap-1">
                            {data.revYoYPct >= 0 ? (
                                <TrendingUp className="w-3 h-3 text-emerald-600" />
                            ) : (
                                <TrendingDown className="w-3 h-3 text-red-600" />
                            )}
                            {fmtPct(data.revYoYPct)} vs {data.ytd2025To.slice(0, 4)}
                        </span>
                    }
                />
                <Kpi
                    title="New Product Share"
                    value={fmtPctRaw(sharePct)}
                    sub={`Target 30–40% · ${fmtThb(data.new2026Rev + data.new2025Rev)} new rev`}
                />
                <Kpi
                    title="Weighted GM%"
                    value={fmtPctRaw(data.totalGrossMarginPct)}
                    sub="Revenue-weighted across SKUs with cost"
                />
                <Kpi
                    title="Tracked SKUs (ROP)"
                    value={String(data.stockSkus.length)}
                    sub={
                        <Link href="/analytics/stock" className="underline">
                            Open stock dashboard →
                        </Link>
                    }
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>New Product Share vs Target (30–40%)</CardTitle>
                    <CardDescription>
                        (New 2026 + New 2025) / total company revenue · YTD {data.ytd2026To.slice(0, 4)}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span>0%</span>
                        <span className="font-semibold text-emerald-700">{sharePct.toFixed(1)}%</span>
                        <span>100%</span>
                    </div>
                    <div className="relative">
                        <Progress value={Math.min(sharePct, 100)} className="h-4" />
                        <div
                            className="absolute top-0 h-4 border-l-2 border-amber-500 opacity-70"
                            style={{ left: "30%" }}
                            title="30% target"
                        />
                        <div
                            className="absolute top-0 h-4 border-l-2 border-emerald-600 opacity-70"
                            style={{ left: "40%" }}
                            title="40% target"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Gap to 30%: {fmtThb(data.gapToTargetLow)} · Gap to 40%:{" "}
                        {fmtThb(data.gapToTargetHigh)}
                    </p>
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Revenue Bridge (YTD)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bridgeData} layout="vertical" margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                                <YAxis type="category" dataKey="name" width={70} />
                                <Tooltip formatter={(v) => fmtThb(Number(v ?? 0))} />
                                <Bar dataKey="value" radius={4}>
                                    {bridgeData.map((e, i) => (
                                        <Cell key={i} fill={e.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Top Gainers / Decliners (Δ rev YTD)</CardTitle>
                        <CardDescription>Click SKU for Product Deep-Dive</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={diverging.slice(0, 14)} layout="vertical" margin={{ left: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                                <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(v) => fmtThb(Number(v ?? 0))} />
                                <ReferenceLine x={0} stroke="#666" />
                                <Bar dataKey="delta" radius={2}>
                                    {diverging.slice(0, 14).map((e, i) => (
                                        <Cell
                                            key={i}
                                            fill={e.delta >= 0 ? "#10b981" : "#ef4444"}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                    <CardContent className="pt-0 border-t">
                        <ul className="text-xs space-y-1 max-h-32 overflow-auto">
                            {diverging.slice(0, 10).map((d) => (
                                <li key={d.sku} className="flex justify-between gap-2">
                                    <SkuLink sku={d.sku} className="font-mono" />
                                    <span
                                        className={
                                            d.delta >= 0
                                                ? "text-emerald-600"
                                                : "text-red-600"
                                        }
                                    >
                                        {d.delta >= 0 ? "+" : ""}
                                        {fmtThb(d.delta)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <GpPriceChart data={data} />
        </div>
    )
}

function Kpi({
    title,
    value,
    sub,
}: {
    title: string
    value: string
    sub: React.ReactNode
}) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{sub}</div>
            </CardContent>
        </Card>
    )
}
