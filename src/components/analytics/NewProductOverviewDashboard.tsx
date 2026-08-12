"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import type { NewProductOverview } from "@/lib/analytics/new-product-overview"
import { GpPriceChart } from "@/components/analytics/GpPriceChart"
import { SkuLink } from "@/components/analytics/SkuLink"
import { fmtThb, fmtNum, fmtPct, fmtPctRaw } from "@/lib/analytics/format"
import {
    Sparkles,
    Target,
    Coins,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
} from "lucide-react"

function gmClass(pct: number | null): string {
    if (pct == null) return "text-muted-foreground"
    if (pct < 0) return "text-red-600 font-semibold"
    if (pct >= 55) return "text-emerald-700 font-medium"
    if (pct >= 35) return "text-amber-600"
    return "text-orange-600"
}

export function NewProductOverviewDashboard({ data }: { data: NewProductOverview }) {
    const year = data.ytd2026To.slice(0, 4)
    const gpUp = (data.gpTrendPct ?? 0) >= 0
    const priceUp = (data.priceTrendPct ?? 0) >= 0

    const growthText = `สินค้าใหม่ปี ${year} (${data.cohortLabel}) ทำรายได้ ${fmtThb(
        data.revenueYtd,
    )} จาก ${data.activeSkuCount}/${data.skuCount} SKU ที่มียอดขาย คิดเป็น ${data.shareOfCompanyPct.toFixed(
        1,
    )}% ของรายได้บริษัท (YTD ${data.ytd2026From} → ${data.ytd2026To}).`

    const gpText =
        data.gpTrendPct == null
            ? `กำไรขั้นต้นรวม ${fmtThb(data.grossProfitYtd)} · GM% เฉลี่ย ${fmtPctRaw(
                  data.weightedGmPct,
              )}.`
            : `กำไรขั้นต้นรวม ${fmtThb(data.grossProfitYtd)} (GM% ${fmtPctRaw(
                  data.weightedGmPct,
              )}) · แนวโน้ม 3 เดือนล่าสุด ${gpUp ? "เพิ่มขึ้น" : "ลดลง"} ${fmtPct(
                  Math.abs(data.gpTrendPct),
              )} เทียบ 3 เดือนก่อนหน้า.`

    return (
        <div className="space-y-6">
            {/* Product Story (New 2026) */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="w-5 h-5 text-primary" />
                        New Product Story — {data.cohortLabel} · ศักยภาพการเติบโต & กำไร
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border bg-card p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Target className="w-4 h-4 text-emerald-600" />
                                ศักยภาพการเติบโต (Growth potential)
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {growthText}
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                                <Badge
                                    variant="outline"
                                    className="bg-emerald-100 text-emerald-800 border-emerald-200"
                                >
                                    Contribution {data.shareOfCompanyPct.toFixed(1)}%
                                </Badge>
                                {data.priceTrendPct != null && (
                                    <Badge
                                        variant="outline"
                                        className={
                                            priceUp
                                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                : "bg-amber-100 text-amber-800 border-amber-200"
                                        }
                                    >
                                        {priceUp ? (
                                            <TrendingUp className="w-3 h-3 mr-1" />
                                        ) : (
                                            <TrendingDown className="w-3 h-3 mr-1" />
                                        )}
                                        ASP {fmtPct(data.priceTrendPct)} 3M
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="rounded-lg border bg-card p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Coins className="w-4 h-4 text-amber-600" />
                                กำไรขั้นต้นเพิ่มขึ้นไหม? (GP trend)
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {gpText}
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {data.gpTrendPct != null && (
                                    <Badge
                                        variant="outline"
                                        className={
                                            gpUp
                                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                : "bg-red-100 text-red-800 border-red-200"
                                        }
                                    >
                                        {gpUp ? (
                                            <TrendingUp className="w-3 h-3 mr-1" />
                                        ) : (
                                            <TrendingDown className="w-3 h-3 mr-1" />
                                        )}
                                        GP {fmtPct(data.gpTrendPct)} 3M
                                    </Badge>
                                )}
                                <Badge variant="outline">
                                    GM% {fmtPctRaw(data.weightedGmPct)}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        GP คำนวณหลังหักช่องทาง (Marketplace −32% / Direct −19%) · ขอบเขต:{" "}
                        {data.cohortLabel} เท่านั้น
                    </p>
                </CardContent>
            </Card>

            {data.lossSkus.length > 0 && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        {data.lossSkus.length} SKU ขาดทุน (GM% ติดลบ):{" "}
                        {data.lossSkus
                            .slice(0, 6)
                            .map((s) => `${s.productName} (${s.sku})`)
                            .join(" · ")}
                        {data.lossSkus.length > 6 ? "…" : ""}
                    </AlertDescription>
                </Alert>
            )}

            {/* KPI cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Kpi title="Revenue YTD" value={fmtThb(data.revenueYtd)} sub={`${data.cohortLabel} only`} />
                <Kpi title="Gross Profit YTD" value={fmtThb(data.grossProfitYtd)} sub={`GM% ${fmtPctRaw(data.weightedGmPct)}`} />
                <Kpi title="Units / Orders" value={`${fmtNum(data.unitsYtd)} / ${fmtNum(data.ordersYtd)}`} sub={data.avgSellPrice != null ? `ASP ${fmtThb(data.avgSellPrice)}` : "—"} />
                <Kpi title="Active SKUs" value={`${data.activeSkuCount} / ${data.skuCount}`} sub={`${data.zeroSaleSkus.length} ยังไม่มียอดขาย`} />
            </div>

            {/* Contribution gauge */}
            <Card>
                <CardHeader>
                    <CardTitle>Contribution to company revenue</CardTitle>
                    <CardDescription>
                        {data.cohortLabel} = {fmtThb(data.revenueYtd)} จากรายได้รวม{" "}
                        {fmtThb(data.companyRevenueYtd)} (YTD {year})
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>0%</span>
                        <span className="font-semibold text-emerald-700">
                            {data.shareOfCompanyPct.toFixed(1)}%
                        </span>
                        <span>100%</span>
                    </div>
                    <Progress value={Math.min(data.shareOfCompanyPct, 100)} className="h-4" />
                </CardContent>
            </Card>

            {/* GP vs price trend (scoped) */}
            <GpPriceChart
                data={data}
                title={`GP trend vs Selling price — ${data.cohortLabel}`}
                description="รายเดือน (18 เดือน) · เฉพาะสินค้าใหม่ปี 2026 · GP หลังหักช่องทาง"
            />

            {/* Leaderboards */}
            <div className="grid gap-4 lg:grid-cols-2">
                <LeaderTable
                    title="Top by Revenue"
                    rows={data.topByRevenue}
                    metric="revenue"
                />
                <LeaderTable
                    title="Top by Gross Profit"
                    rows={data.topByGrossProfit}
                    metric="grossProfit"
                />
            </div>
        </div>
    )
}

function Kpi({ title, value, sub }: { title: string; value: string; sub: React.ReactNode }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{sub}</div>
            </CardContent>
        </Card>
    )
}

function LeaderTable({
    title,
    rows,
    metric,
}: {
    title: string
    rows: import("@/lib/analytics/new-product-overview").NewProductSkuRow[]
    metric: "revenue" | "grossProfit"
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>SKU / Name</TableHead>
                            <TableHead className="text-right">
                                {metric === "revenue" ? "Revenue" : "Gross profit"}
                            </TableHead>
                            <TableHead className="text-right">GM%</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow key={r.sku}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <SkuLink sku={r.sku} className="font-mono text-xs" />
                                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                            {r.productName}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    {fmtThb(metric === "revenue" ? r.revenue : r.grossProfit)}
                                </TableCell>
                                <TableCell className={`text-right ${gmClass(r.gmPct)}`}>
                                    {r.gmPct != null ? fmtPctRaw(r.gmPct) : "—"}
                                </TableCell>
                            </TableRow>
                        ))}
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground h-20">
                                    No data
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
