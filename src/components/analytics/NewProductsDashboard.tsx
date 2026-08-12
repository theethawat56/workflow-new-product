"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ZAxis,
} from "recharts"
import type { AnalyticsOverview, Cohort, SkuWindowMetrics } from "@/lib/analytics/types"
import { NEW_2026_SKUS, NEW_2025_SKUS } from "@/lib/analytics/constants"
import { DEDUCTION_LABELS } from "@/lib/sales/channel"
import { fmtThb, fmtNum, fmtPctRaw } from "@/lib/analytics/format"
import { cn } from "@/lib/utils"
import { SkuLink } from "@/components/analytics/SkuLink"
import { AlertTriangle } from "lucide-react"

type CohortFilter = "NEW_2026" | "NEW_2025" | "BOTH"

const COHORT_BADGE: Record<Cohort, string> = {
    NEW_2026: "bg-emerald-100 text-emerald-800 border-emerald-200",
    NEW_2025: "bg-sky-100 text-sky-800 border-sky-200",
    CORE: "bg-muted text-muted-foreground",
}

function gmClass(pct: number | null): string {
    if (pct == null) return "text-muted-foreground"
    if (pct < 0) return "text-red-600 font-semibold"
    if (pct >= 55) return "text-emerald-700 font-medium"
    if (pct >= 35) return "text-amber-600"
    return "text-orange-600"
}

export function NewProductsDashboard({ data }: { data: AnalyticsOverview }) {
    const [cohortFilter, setCohortFilter] = useState<CohortFilter>("BOTH")
    const [sortKey, setSortKey] = useState<keyof SkuWindowMetrics>("revenue")
    const [sortAsc, setSortAsc] = useState(false)

    const cohortSkus = useMemo(() => {
        let rows = data.skuMetricsYtd
        if (cohortFilter === "NEW_2026") {
            rows = rows.filter((r) => r.cohort === "NEW_2026")
        } else if (cohortFilter === "NEW_2025") {
            rows = rows.filter((r) => r.cohort === "NEW_2025")
        } else {
            rows = rows.filter((r) => r.cohort === "NEW_2026" || r.cohort === "NEW_2025")
        }
        return [...rows].sort((a, b) => {
            const av = a[sortKey] ?? 0
            const bv = b[sortKey] ?? 0
            if (typeof av === "string" && typeof bv === "string") {
                return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
            }
            return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av)
        })
    }, [data.skuMetricsYtd, cohortFilter, sortKey, sortAsc])

    const listed2026 = [...NEW_2026_SKUS]
    const listed2025 = [...NEW_2025_SKUS]
    const soldSkus = new Set(data.skuMetricsYtd.filter((s) => s.units > 0).map((s) => s.sku))
    const zeroSales2026 = listed2026.filter((s) => !soldSkus.has(s))
    const lossSkus = cohortSkus.filter((s) => s.isLoss)

    const scatterData = cohortSkus
        .filter((s) => s.grossMarginPct != null && s.units > 0)
        .map((s) => ({
            sku: s.sku,
            name: s.productName,
            units: s.units,
            gm: s.grossMarginPct!,
            revenue: s.revenue,
        }))

    const medianUnits =
        scatterData.length > 0
            ? [...scatterData].sort((a, b) => a.units - b.units)[
                  Math.floor(scatterData.length / 2)
              ]?.units ?? 0
            : 0

    function toggleSort(key: keyof SkuWindowMetrics) {
        if (sortKey === key) setSortAsc(!sortAsc)
        else {
            setSortKey(key)
            setSortAsc(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
                {(["BOTH", "NEW_2026", "NEW_2025"] as const).map((c) => (
                    <Button
                        key={c}
                        variant={cohortFilter === c ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCohortFilter(c)}
                    >
                        {c === "BOTH" ? "Both cohorts" : c.replace("_", " ")}
                    </Button>
                ))}
            </div>

            {(lossSkus.length > 0 || zeroSales2026.length > 0) && (
                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            Action list
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                        {lossSkus.length > 0 && (
                            <div>
                                <strong className="text-red-700">Negative GM% (mispriced / bad cost):</strong>{" "}
                                {lossSkus.map((s) => `${s.productName} (${s.sku})`).join(" · ")}
                            </div>
                        )}
                        {zeroSales2026.length > 0 && (
                            <div>
                                <strong>Listed New 2026, 0 YTD sales:</strong>{" "}
                                {zeroSales2026.join(", ")}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Cohort performance (YTD)</CardTitle>
                    <CardDescription>
                        GM% = net GP ÷ revenue per order (Marketplace −32% / Direct −19%) ·{" "}
                        <Link href="/analytics/data" className="underline">
                            trace rows
                        </Link>
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[70vh] overflow-auto rounded-b-lg border-t">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="sticky top-0 z-10 bg-background border-b shadow-sm">
                                <tr>
                                    <SortHead label="SKU" onClick={() => toggleSort("sku")} />
                                    <SortHead label="Name" onClick={() => toggleSort("productName")} />
                                    <SortHead label="Units" onClick={() => toggleSort("units")} />
                                    <SortHead label="Revenue" onClick={() => toggleSort("revenue")} />
                                    <SortHead label="Unit cost" onClick={() => toggleSort("unitCost")} />
                                    <SortHead label="Avg sell" onClick={() => toggleSort("avgSellPrice")} />
                                    <SortHead label="GM%" onClick={() => toggleSort("grossMarginPct")} />
                                    <SortHead label="Cohort" onClick={() => toggleSort("cohort")} />
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-background">
                                        Season
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {cohortSkus.map((s) => (
                                    <tr
                                        key={s.sku}
                                        className="border-b transition-colors hover:bg-muted/50"
                                    >
                                        <td className="p-4 font-mono text-xs">
                                            <SkuLink sku={s.sku} />
                                        </td>
                                        <td className="p-4 max-w-[200px] truncate">{s.productName}</td>
                                        <td className="p-4">{fmtNum(s.units)}</td>
                                        <td className="p-4">{fmtThb(s.revenue)}</td>
                                        <td className="p-4">
                                            {s.unitCost != null ? fmtThb(s.unitCost) : "—"}
                                        </td>
                                        <td className="p-4">
                                            {s.avgSellPrice != null ? fmtThb(s.avgSellPrice) : "—"}
                                        </td>
                                        <td className={cn("p-4", gmClass(s.grossMarginPct))}>
                                            {s.grossMarginPct != null
                                                ? fmtPctRaw(s.grossMarginPct)
                                                : "—"}
                                        </td>
                                        <td className="p-4">
                                            <Badge
                                                variant="outline"
                                                className={COHORT_BADGE[s.cohort]}
                                            >
                                                {s.cohort}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-xs">{s.seasonality}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="px-6 py-3 text-xs text-muted-foreground border-t">
                        {DEDUCTION_LABELS.MARKETPLACE} · {DEDUCTION_LABELS.DIRECT}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Velocity vs Margin</CardTitle>
                    <CardDescription>
                        Top-right = STAR (high units + GM% ≥ 55). Median units ={" "}
                        {fmtNum(medianUnits)}
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                dataKey="units"
                                name="Units"
                                label={{ value: "Units (velocity)", position: "bottom" }}
                            />
                            <YAxis
                                type="number"
                                dataKey="gm"
                                name="GM%"
                                label={{ value: "GM%", angle: -90, position: "left" }}
                            />
                            <ZAxis type="number" dataKey="revenue" range={[40, 400]} />
                            <Tooltip
                                cursor={{ strokeDasharray: "3 3" }}
                                formatter={(v, name) =>
                                    name === "revenue" ? fmtThb(Number(v ?? 0)) : v
                                }
                                labelFormatter={(_, p) =>
                                    p?.[0]?.payload
                                        ? `${p[0].payload.name} (${p[0].payload.sku})`
                                        : ""
                                }
                            />
                            <ReferenceLine y={55} stroke="#10b981" strokeDasharray="4 4" />
                            <ReferenceLine x={medianUnits} stroke="#6366f1" strokeDasharray="4 4" />
                            <Scatter data={scatterData} fill="#0ea5e9" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}

function SortHead({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-background">
            <button
                type="button"
                onClick={onClick}
                className="w-full text-left hover:text-foreground transition-colors"
            >
                {label}
            </button>
        </th>
    )
}
