"use client"

import { useCallback, useMemo, type ComponentType } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import type { LaunchCommandCenterData, LaunchGroupDetail } from "@/lib/analytics/launch-types"
import {
    GP_TARGET_PCT,
    RUN_RATE_HIT,
    SALES_TARGET_M2_HIGH,
    SALES_TARGET_M2_LOW,
    TIER_KOL_TARGETS,
} from "@/lib/analytics/launch-constants"
import { fmtNum, fmtPctRaw, fmtThb } from "@/lib/analytics/format"
import { cn } from "@/lib/utils"
import { ALERT_STYLE, VERDICT_STYLE } from "@/components/analytics/launch-styles"
import {
    AlertTriangle,
    ArrowLeft,
    BarChart3,
    CheckCircle2,
    ChevronRight,
    Link2,
    Megaphone,
    Package,
    TrendingUp,
} from "lucide-react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

function GaugeBar({
    value,
    low,
    high,
    label,
}: {
    value: number
    low: number
    high: number
    label: string
}) {
    const max = Math.max(high * 1.2, value, 1)
    const pct = Math.min(100, (value / max) * 100)
    const lowPct = (low / max) * 100
    const highPct = (high / max) * 100
    const inTarget = value >= low && value <= high

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn("font-semibold", inTarget ? "text-emerald-700" : "text-amber-700")}>
                    {fmtThb(value)}
                </span>
            </div>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <div
                    className="absolute top-0 bottom-0 bg-emerald-200/80 border-x border-emerald-400"
                    style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
                />
                <div
                    className={cn(
                        "absolute top-0 left-0 bottom-0 rounded-full",
                        inTarget ? "bg-emerald-500" : "bg-amber-500",
                    )}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>เป้า {fmtThb(low)}</span>
                <span>{fmtThb(high)}</span>
            </div>
        </div>
    )
}

function PanelHeader({
    icon: Icon,
    title,
    subtitle,
}: {
    icon: ComponentType<{ className?: string }>
    title: string
    subtitle: string
}) {
    return (
        <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-xs">{subtitle}</CardDescription>
            </div>
        </div>
    )
}

function MonthlyTable({ rows }: { rows: LaunchGroupDetail["monthlyTable"] }) {
    return (
        <div className="overflow-x-auto rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead>เดือน</TableHead>
                        <TableHead className="text-right">จำนวน</TableHead>
                        <TableHead className="text-right">รายได้</TableHead>
                        <TableHead className="text-right">Net GP</TableHead>
                        <TableHead className="text-right">Net Margin%</TableHead>
                        <TableHead className="text-right">ค่าการตลาด</TableHead>
                        <TableHead className="text-right">Mktg%</TableHead>
                        <TableHead className="text-right">โพสต์ KOL</TableHead>
                        <TableHead className="text-right">vs เป้า</TableHead>
                        <TableHead className="text-right">สต็อกสิ้นเดือน</TableHead>
                        <TableHead className="text-right">Days Cover</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((r) => (
                        <TableRow key={r.monthLabel}>
                            <TableCell className="font-medium whitespace-nowrap">
                                M{r.monthIndex} · {r.monthLabel}
                            </TableCell>
                            <TableCell className="text-right">{fmtNum(r.units)}</TableCell>
                            <TableCell
                                className={cn(
                                    "text-right",
                                    r.runRateStatus === "hit" && "text-emerald-700 font-medium",
                                    r.runRateStatus === "miss" && "text-red-600 font-medium",
                                )}
                            >
                                {fmtThb(r.revenue)}
                            </TableCell>
                            <TableCell className="text-right">{fmtThb(r.netGp)}</TableCell>
                            <TableCell
                                className={cn(
                                    "text-right",
                                    r.netMarginPct != null && r.netMarginPct >= GP_TARGET_PCT
                                        ? "text-emerald-700"
                                        : r.netMarginPct != null
                                          ? "text-red-600"
                                          : "",
                                )}
                            >
                                {r.netMarginPct != null ? fmtPctRaw(r.netMarginPct) : "—"}
                            </TableCell>
                            <TableCell className="text-right">{fmtThb(r.mktgCost)}</TableCell>
                            <TableCell className="text-right">
                                {r.mktgPct != null ? fmtPctRaw(r.mktgPct) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                                {r.kolPosts}
                                {r.kolPosts > 0 && (
                                    <span className="text-muted-foreground ml-1">
                                        ({r.barterPosts}B/{r.paidPosts}P)
                                    </span>
                                )}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                                {r.runRateStatus === "hit" ? (
                                    <span className="text-emerald-700">✓ ≥{fmtThb(r.runRateTarget)}</span>
                                ) : r.runRateStatus === "miss" ? (
                                    <span className="text-red-600">✗ &lt;{fmtThb(r.runRateTarget)}</span>
                                ) : (
                                    "—"
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                {r.stockEnd != null ? fmtNum(r.stockEnd) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                                {r.daysCover != null ? `${Math.round(r.daysCover)}d` : "—"}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

export function LaunchProductDetailView({
    data,
    detail: d,
}: {
    data: LaunchCommandCenterData
    detail: LaunchGroupDetail
}) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const onGroupChange = useCallback(
        (groupId: string) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("group", groupId)
            router.push(`/analytics/new-overview?${params.toString()}`)
        },
        [router, searchParams],
    )

    const channelDonut = useMemo(() => {
        const total = d.channelSplit.marketplace + d.channelSplit.direct + d.channelSplit.other
        if (total <= 0) return []
        return [
            { name: "Marketplace", value: d.channelSplit.marketplace, fill: "#6366f1" },
            { name: "Direct", value: d.channelSplit.direct, fill: "#10b981" },
        ].filter((x) => x.value > 0)
    }, [d.channelSplit])

    const tierKol = TIER_KOL_TARGETS[d.tier]
    const seedOk = d.seedCapPct <= 40

    return (
        <div className="space-y-6">
            <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Link
                        href="/analytics/new-overview"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        ภาพรวม Portfolio
                    </Link>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-foreground font-medium truncate max-w-[240px]">{d.label}</span>
                </div>

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-xl sm:text-2xl font-bold">{d.label}</h1>
                        <p className="text-sm text-muted-foreground">
                            Level 2 — Sales × Stock × KOL · {d.groupId}
                        </p>
                    </div>
                    <Badge className={cn("text-sm px-3 py-1 border", VERDICT_STYLE[d.verdict])}>
                        {d.verdict}
                    </Badge>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <Button variant="outline" size="sm" asChild className="shrink-0">
                        <Link href="/analytics/new-overview">
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            กลับภาพรวม
                        </Link>
                    </Button>
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            สลับรุ่น
                        </label>
                        <Select value={d.groupId} onValueChange={onGroupChange}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {data.groups.map((g) => (
                                    <SelectItem key={g.groupId} value={g.groupId}>
                                        {g.label} · {g.verdict}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                        <Badge variant="outline">Tier {d.tier}</Badge>
                        <Badge variant="outline">ASP {fmtThb(d.asp)}</Badge>
                        <Badge variant="outline">COGS {fmtThb(d.cogs)}</Badge>
                        <Badge variant="outline">Net GM {fmtPctRaw(d.netMarginPct)}</Badge>
                        {d.launchDate && <Badge variant="outline">เปิดตัว {d.launchDate}</Badge>}
                        <Badge variant="outline">Month {d.monthIndex}</Badge>
                    </div>
                </div>
                {d.skus.length > 1 && (
                    <p className="text-xs text-muted-foreground font-mono">SKUs: {d.skus.join(", ")}</p>
                )}
            </div>

            {d.alerts.length > 0 && (
                <div className="space-y-2">
                    {d.alerts.map((a, i) => (
                        <Alert key={a} className={cn("border", ALERT_STYLE[a])}>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>{a}</AlertTitle>
                            <AlertDescription>{d.alertMessages[i] ?? a}</AlertDescription>
                        </Alert>
                    ))}
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <PanelHeader icon={TrendingUp} title="SALES" subtitle="Run-rate · Net GP · ช่องทาง" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <GaugeBar
                            value={d.runRate}
                            low={d.runRateTarget.low || SALES_TARGET_M2_LOW}
                            high={d.runRateTarget.high || SALES_TARGET_M2_HIGH}
                            label="Run-rate (เดือนล่าสุด)"
                        />
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span>Net GP%</span>
                                <span
                                    className={cn(
                                        "font-semibold",
                                        d.netMarginPct >= GP_TARGET_PCT ? "text-emerald-700" : "text-red-600",
                                    )}
                                >
                                    {fmtPctRaw(d.netMarginPct)} / เป้า {GP_TARGET_PCT}%
                                </span>
                            </div>
                            <Progress
                                value={Math.min(100, (d.netMarginPct / GP_TARGET_PCT) * 100)}
                                className="h-2"
                            />
                        </div>
                        <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={d.salesMonthly}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                    <YAxis
                                        yAxisId="left"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}K`}
                                    />
                                    <Tooltip formatter={(v) => fmtThb(Number(v ?? 0))} />
                                    <Bar yAxisId="left" dataKey="revenue" fill="#6366f1" name="รายได้" radius={[2, 2, 0, 0]} />
                                    <Line yAxisId="left" type="monotone" dataKey="units" stroke="#f59e0b" name="จำนวน" dot={false} />
                                    <ReferenceLine yAxisId="left" y={SALES_TARGET_M2_LOW} stroke="#10b981" strokeDasharray="4 4" />
                                    <ReferenceLine yAxisId="left" y={SALES_TARGET_M2_HIGH} stroke="#059669" strokeDasharray="4 4" />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        {channelDonut.length > 0 && (
                            <div className="h-[120px] flex items-center gap-2">
                                <ResponsiveContainer width="50%" height="100%">
                                    <PieChart>
                                        <Pie data={channelDonut} dataKey="value" innerRadius={30} outerRadius={50} paddingAngle={2}>
                                            {channelDonut.map((e, i) => (
                                                <Cell key={i} fill={e.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v) => fmtThb(Number(v ?? 0))} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="text-xs space-y-1">
                                    {channelDonut.map((c) => (
                                        <div key={c.name} className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full" style={{ background: c.fill }} />
                                            {c.name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <PanelHeader icon={Package} title="STOCK" subtitle="คงเหลือ · Days cover · Lot · Seed cap" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground">สต็อกคงเหลือ</p>
                                <p className="text-xl font-bold">{fmtNum(d.currentStock)}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground">Days cover</p>
                                <p
                                    className={cn(
                                        "text-xl font-bold",
                                        d.daysCover != null && d.daysCover < d.leadTimeDays ? "text-red-600" : "",
                                    )}
                                >
                                    {d.daysCover != null ? `${Math.round(d.daysCover)}d` : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground">Lead {d.leadTimeDays}d</p>
                            </div>
                        </div>
                        {d.daysCover != null && d.daysCover < d.leadTimeDays && (
                            <Alert className="border-red-300 bg-red-50 py-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                    ⚠️ Reorder alert — days_cover &lt; lead time
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <p className="text-xs font-medium">Lot timeline</p>
                            {d.lots.slice(0, 4).map((lot, i) => (
                                <div key={`${lot.lotNo}-${i}`} className="text-xs border rounded p-2">
                                    <span className="font-medium">{lot.lotNo}</span>
                                    <span className="text-muted-foreground ml-2">{fmtNum(lot.qtyOrdered)} ชิ้น</span>
                                    {lot.orderDate && (
                                        <span className="text-muted-foreground ml-2">
                                            {lot.orderDate} → {lot.arrivalDate || "—"}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-medium">จัดสรรสต็อก</p>
                            <div className="flex h-4 rounded-full overflow-hidden bg-muted">
                                {d.currentStock > 0 && (
                                    <>
                                        <div className="bg-orange-400" style={{ width: `${(d.seedUnits / d.currentStock) * 100}%` }} />
                                        <div className="bg-purple-400" style={{ width: `${(d.barterUnits / d.currentStock) * 100}%` }} />
                                        <div className="bg-emerald-500 flex-1" />
                                    </>
                                )}
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Seed {d.seedUnits}</span>
                                <span>Barter {d.barterUnits}</span>
                                <span>ขาย {d.sellableUnits}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            {seedOk ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                            )}
                            <span>
                                Seed cap: {d.seedCapPct.toFixed(0)}% / เป้า ≤40% (เพดาน {d.seedCapLimit} เครื่อง@300K)
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <PanelHeader icon={Megaphone} title="KOL / MARKETING" subtitle="Mktg% · โพสต์ barter vs จ้าง" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={d.kolMonthly}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} domain={[0, 15]} />
                                    <Tooltip />
                                    <Line yAxisId="right" type="monotone" dataKey="mktgPct" stroke="#ef4444" name="Mktg%" dot />
                                    <Line yAxisId="right" type="monotone" dataKey="mktgTarget" stroke="#10b981" strokeDasharray="4 4" name="เป้า" dot={false} />
                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="h-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={d.kolMonthly}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="barterPosts" stackId="a" fill="#a855f7" name="Barter" />
                                    <Bar dataKey="paidPosts" stackId="a" fill="#3b82f6" name="จ้าง" radius={[2, 2, 0, 0]} />
                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded border p-2">
                                <p className="text-xs text-muted-foreground">งบสะสม KOL</p>
                                <p className="font-semibold">{fmtThb(d.cumulativeKolCost)}</p>
                            </div>
                            <div className="rounded border p-2">
                                <p className="text-xs text-muted-foreground">GP / KOL</p>
                                <p className="font-semibold">{d.gpPerKol != null ? `${d.gpPerKol.toFixed(2)}x` : "—"}</p>
                            </div>
                        </div>
                        <Badge variant="outline">
                            แนะนำ: {d.barterRecommendation} · opp cost/ตัว {fmtThb(d.barterOppCostPerUnit)}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                            เป้า tier {d.tier}: {tierKol.barterPosts} barter + {tierKol.paidPosts} จ้าง · seed {tierKol.seed}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-primary/30">
                <CardHeader className="pb-2">
                    <PanelHeader icon={Link2} title="THE LINK — KOL → Sales lag" subtitle="โพสต์เดือน t vs ยอดขาย t และ t+1" />
                </CardHeader>
                <CardContent>
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={d.linkSeries}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}K`} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                                <Tooltip
                                    formatter={(v, name) =>
                                        String(name).includes("Posts") ? Number(v ?? 0) : fmtThb(Number(v ?? 0))
                                    }
                                />
                                <Bar yAxisId="left" dataKey="revenue" fill="#6366f1" name="รายได้ t" opacity={0.7} />
                                <Bar yAxisId="left" dataKey="revenueLag1" fill="#818cf8" name="รายได้ t+1" opacity={0.5} />
                                <Line yAxisId="right" type="monotone" dataKey="kolPosts" stroke="#f59e0b" strokeWidth={2} name="โพสต์ KOL" />
                                <ReferenceLine yAxisId="left" y={RUN_RATE_HIT} stroke="#10b981" strokeDasharray="4 4" />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        <div>
                            <CardTitle>ตารางยอดขายรายเดือน</CardTitle>
                            <CardDescription>Success only · Net GP หลังหักช่องทาง 32%/19%</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <MonthlyTable rows={d.monthlyTable} />
                </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
                ข้อมูล ณ {new Date(data.dataAsOf).toLocaleString("th-TH")} · cache 30 นาที
            </p>
        </div>
    )
}
