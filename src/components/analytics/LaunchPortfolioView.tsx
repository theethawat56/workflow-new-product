"use client"

import { useCallback, useMemo, useState, type ComponentType } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import type { LaunchCommandCenterData, PortfolioRow } from "@/lib/analytics/launch-types"
import {
    GP_TARGET_PCT,
    RUN_RATE_HIT,
    SALES_TARGET_M2_HIGH,
    SALES_TARGET_M2_LOW,
} from "@/lib/analytics/launch-constants"
import { fmtNum, fmtPctRaw, fmtThb } from "@/lib/analytics/format"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import {
    ALERT_STYLE,
    SCATTER_COLORS,
    VERDICT_STYLE,
    cellStatusClass,
} from "@/components/analytics/launch-styles"
import {
    AlertTriangle,
    ArrowRight,
    LayoutGrid,
    Loader2,
    Rocket,
    TrendingUp,
} from "lucide-react"
import {
    CartesianGrid,
    Cell,
    ReferenceLine,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
    ZAxis,
} from "recharts"

type SortKey = keyof Pick<
    PortfolioRow,
    "label" | "avgMonthlyRevenue" | "netMarginPct" | "mktgPct" | "currentStock" | "verdict"
>

function RunRateProgressBar({
    groupId,
    label,
    runRate,
    progressPct,
    progressGoal,
    defaultProgressGoal: defaultProgressGoalProp,
    isCustomProgressGoal: isCustomProgressGoalProp,
    source,
    sourceMonth,
    status,
}: {
    groupId: string
    label: string
    runRate: number
    progressPct: number
    progressGoal: number
    defaultProgressGoal?: number
    isCustomProgressGoal?: boolean
    source: PortfolioRow["runRateSource"]
    sourceMonth?: string
    status: PortfolioRow["runRateStatus"]
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [draftGoal, setDraftGoal] = useState(String(progressGoal))
    const [saving, setSaving] = useState(false)

    const defaultProgressGoal = defaultProgressGoalProp ?? progressGoal
    const isCustomProgressGoal = isCustomProgressGoalProp ?? false

    const barClass =
        status === "hit"
            ? "[&>div]:bg-emerald-500"
            : status === "near"
              ? "[&>div]:bg-amber-500"
              : status === "miss"
                ? "[&>div]:bg-red-500"
                : ""

    const sourceLabel =
        source === "prev_month"
            ? `เดือน ${sourceMonth}`
            : source === "current_mtd"
              ? `MTD ${sourceMonth}`
              : source === "last_30d"
                ? "30 วันล่าสุด"
                : ""

    const handleOpenChange = (next: boolean) => {
        if (next) setDraftGoal(String(progressGoal))
        setOpen(next)
    }

    const saveGoal = async (goal: number | null) => {
        setSaving(true)
        try {
            const res = await fetch("/api/analytics/launch-progress-targets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    groupId,
                    label,
                    progressGoal: goal,
                }),
            })
            if (res.status === 401) {
                alert("กรุณา Login ก่อนบันทึกเป้า")
                return
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error ?? "save failed")
            }
            setOpen(false)
            router.refresh()
        } catch (err) {
            alert(err instanceof Error ? err.message : "บันทึกเป้าไม่สำเร็จ")
        } finally {
            setSaving(false)
        }
    }

    const handleSave = () => {
        const goal = Number(String(draftGoal).replace(/,/g, ""))
        if (!Number.isFinite(goal) || goal <= 0) {
            alert("กรุณาใส่เป้ายอดขายที่ถูกต้อง")
            return
        }
        void saveGoal(goal)
    }

    const handleReset = () => {
        void saveGoal(null)
    }

    return (
        <>
            <button
                type="button"
                className="flex w-full min-w-[120px] max-w-[160px] items-center gap-2 rounded-md border border-transparent px-1 py-1.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                    setDraftGoal(String(progressGoal))
                    setOpen(true)
                }}
                title={
                    runRate > 0
                        ? `คลิกเพื่อดู/แก้เป้า · ${fmtThb(runRate)} vs เป้า ${fmtThb(progressGoal)}`
                        : "คลิกเพื่อตั้งเป้า"
                }
                aria-label={`แก้เป้า ${label}`}
            >
                <Progress
                    value={progressPct}
                    className={cn("h-2 flex-1 pointer-events-none", barClass)}
                />
                <span className="text-xs text-muted-foreground tabular-nums w-9 text-right shrink-0">
                    {runRate > 0 ? `${Math.round(progressPct)}%` : "—"}
                </span>
            </button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>เป้า Progress Bar</DialogTitle>
                        <DialogDescription className="truncate">{label}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium" htmlFor={`goal-${groupId}`}>
                                เป้ายอดขาย (บาท)
                            </label>
                            <Input
                                id={`goal-${groupId}`}
                                type="number"
                                min={1}
                                step={1000}
                                value={draftGoal}
                                onChange={(e) => setDraftGoal(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSave()
                                }}
                                disabled={saving}
                            />
                            <p className="text-xs text-muted-foreground">
                                ค่าเริ่มต้น: {fmtThb(defaultProgressGoal)}
                                {isCustomProgressGoal ? " · แก้ไขแล้ว" : ""}
                            </p>
                            {runRate > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Run-rate: {fmtThb(runRate)}
                                    {sourceLabel ? ` (${sourceLabel})` : ""}
                                </p>
                            )}
                        </div>
                        <div className="rounded-md border bg-muted/30 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <Progress
                                    value={progressPct}
                                    className={cn("h-2 flex-1", barClass)}
                                />
                                <span className="text-xs tabular-nums shrink-0">
                                    {runRate > 0 ? `${Math.round(progressPct)}%` : "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        {isCustomProgressGoal && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleReset}
                                disabled={saving}
                            >
                                รีเซ็ต
                            </Button>
                        )}
                        <Button type="button" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "บันทึก"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export function LaunchPortfolioView({ data }: { data: LaunchCommandCenterData }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [sortKey, setSortKey] = useState<SortKey>("verdict")
    const [sortAsc, setSortAsc] = useState(true)

    const drillDown = useCallback(
        (groupId: string) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set("group", groupId)
            router.push(`/analytics/new-overview?${params.toString()}`)
        },
        [router, searchParams],
    )

    const sortedRows = useMemo(() => {
        const rows = [...data.portfolioRows]
        rows.sort((a, b) => {
            if (sortKey === "verdict") {
                const order = ["STOCK-RISK", "MARGIN-FAIL", "OVER-SEEDING", "BEHIND", "ON-TRACK"]
                const cmp = order.indexOf(a.verdict) - order.indexOf(b.verdict)
                return sortAsc ? cmp : -cmp
            }
            const av = a[sortKey] ?? 0
            const bv = b[sortKey] ?? 0
            if (typeof av === "string") return sortAsc ? av.localeCompare(String(bv)) : String(bv).localeCompare(av)
            return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av)
        })
        return rows
    }, [data.portfolioRows, sortKey, sortAsc])

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc)
        else {
            setSortKey(key)
            setSortAsc(key === "label")
        }
    }

    const p = data.portfolio
    const scatterData = data.scatterData.map((s) => ({
        ...s,
        // Negative Net GP would give sqrt(NaN) and break the dot size.
        z: Math.max(50, Math.sqrt(Math.max(0, s.netGp) / 1000)),
    }))

    return (
        <div className="space-y-6">
            <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-2">
                <div className="flex items-center gap-2">
                    <Rocket className="w-6 h-6 text-primary" />
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold">
                            New Product Launch Command Center
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Level 1 — Portfolio · Sales × Stock × KOL · New{" "}
                            {new Date().getFullYear()} (same rule as Sales dashboard)
                        </p>
                    </div>
                </div>
            </div>

            {/* Rollup KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Verdict ทั้งพอร์ต ({p.productCount} รุ่น)</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-1.5">
                        {(Object.entries(p.verdictCounts) as [keyof typeof p.verdictCounts, number][]).map(
                            ([v, n]) =>
                                n > 0 && (
                                    <Badge key={v} variant="outline" className={cn("text-xs", VERDICT_STYLE[v])}>
                                        {v} {n}
                                    </Badge>
                                ),
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" /> รายได้รวมเดือนล่าสุด
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{fmtThb(p.totalRunRate)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            แตะ 300K: {p.hit300kCount} / ยังไม่ถึง: {p.notHit300kCount}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>ค่าการตลาดรวม · Mktg%</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{fmtThb(p.totalMktgCost)}</p>
                        <p
                            className={cn(
                                "text-sm mt-1",
                                p.portfolioMktgPct <= p.mktgTargetPct * 1.1
                                    ? "text-emerald-700"
                                    : "text-red-600",
                            )}
                        >
                            {fmtPctRaw(p.portfolioMktgPct)} / เป้า ~{fmtPctRaw(p.mktgTargetPct)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Net GP รวม · Margin เฉลี่ย</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{fmtThb(p.totalNetGp)}</p>
                        <p
                            className={cn(
                                "text-sm mt-1",
                                p.avgNetMarginPct >= GP_TARGET_PCT ? "text-emerald-700" : "text-red-600",
                            )}
                        >
                            {fmtPctRaw(p.avgNetMarginPct)} / เป้า {GP_TARGET_PCT}%
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Portfolio table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5" />
                        <div>
                            <CardTitle>ภาพรวมทุกรุ่น</CardTitle>
                            <CardDescription>
                                คลิก Progress Bar เพื่อแก้เป้า · ปุ่ม → เจาะ Level 2
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="cursor-pointer" onClick={() => toggleSort("label")}>
                                    รุ่น
                                </TableHead>
                                <TableHead>tier</TableHead>
                                <TableHead className="text-right">month</TableHead>
                                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("avgMonthlyRevenue")}>
                                    Avg Sale
                                </TableHead>
                                <TableHead>Progress Bar</TableHead>
                                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("netMarginPct")}>
                                    Net GP%
                                </TableHead>
                                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("mktgPct")}>
                                    mktg%
                                </TableHead>
                                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("currentStock")}>
                                    Current Stock
                                </TableHead>
                                <TableHead className="text-right">โพสต์ KOL</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => toggleSort("verdict")}>
                                    Verdict
                                </TableHead>
                                <TableHead className="w-10 text-center" aria-label="เจาะรายละเอียด" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedRows.map((r) => (
                                <TableRow key={r.groupId} className="hover:bg-muted/40">
                                    <TableCell className="font-medium max-w-[180px] truncate">
                                        {r.label}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">
                                            {r.tier}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{r.monthIndex || "—"}</TableCell>
                                    <TableCell className="text-right">
                                        {r.avgMonthlyRevenue > 0 ? (
                                            <div className="leading-tight">
                                                <div className="font-medium">{fmtThb(r.avgMonthlyRevenue)}/mo</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {fmtNum(r.avgMonthlyUnits, 0)} ชิ้น/เดือน
                                                </div>
                                            </div>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                    <TableCell className="py-2">
                                        <RunRateProgressBar
                                            groupId={r.groupId}
                                            label={r.label}
                                            runRate={r.runRate}
                                            progressPct={r.progressPct}
                                            progressGoal={r.progressGoal}
                                            defaultProgressGoal={r.defaultProgressGoal}
                                            isCustomProgressGoal={r.isCustomProgressGoal}
                                            source={r.runRateSource}
                                            sourceMonth={r.runRateSourceMonth}
                                            status={r.runRateStatus}
                                        />
                                    </TableCell>
                                    <TableCell className={cn("text-right", cellStatusClass(r.marginStatus))}>
                                        {fmtPctRaw(r.netMarginPct)}
                                    </TableCell>
                                    <TableCell className={cn("text-right", cellStatusClass(r.mktgStatus))}>
                                        {r.mktgPct != null ? fmtPctRaw(r.mktgPct) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">{fmtNum(r.currentStock)}</TableCell>
                                    <TableCell className="text-right">
                                        {r.kolPostsPerMonth > 0 ? (
                                            <div className="leading-tight">
                                                <div className="font-medium">{r.kolPostsPerMonth}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {r.kolBarterPerMonth}B / {r.kolPaidPerMonth}P
                                                    {r.kolPostsMonthLabel
                                                        ? ` · ${r.kolPostsMonthLabel}`
                                                        : ""}
                                                </div>
                                            </div>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn("text-xs border", VERDICT_STYLE[r.verdict])}>
                                            {r.verdict}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center p-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => drillDown(r.groupId)}
                                            aria-label={`เจาะ ${r.label}`}
                                            title="เจาะ Level 2"
                                        >
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
                {/* Scatter */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Scatter — Run-rate vs Month index</CardTitle>
                        <CardDescription>ขนาดจุด = Net GP · สี = verdict · คลิกจุดเพื่อเจาะ</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis
                                        type="number"
                                        dataKey="monthIndex"
                                        name="Month"
                                        tick={{ fontSize: 10 }}
                                        label={{ value: "Month index", position: "bottom", fontSize: 10 }}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="runRate"
                                        name="Run-rate"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}K`}
                                    />
                                    <ZAxis type="number" dataKey="z" range={[60, 400]} />
                                    <Tooltip
                                        cursor={{ strokeDasharray: "3 3" }}
                                        formatter={(v, name) =>
                                            name === "Run-rate" ? fmtThb(Number(v ?? 0)) : v
                                        }
                                        labelFormatter={(_, payload) =>
                                            payload?.[0]?.payload?.label ?? ""
                                        }
                                    />
                                    <ReferenceLine y={SALES_TARGET_M2_LOW} stroke="#10b981" strokeDasharray="4 4" />
                                    <ReferenceLine y={SALES_TARGET_M2_HIGH} stroke="#059669" strokeDasharray="4 4" />
                                    <Scatter
                                        data={scatterData}
                                        onClick={(pt) => {
                                            const id = pt?.payload?.groupId as string | undefined
                                            if (id) drillDown(id)
                                        }}
                                        style={{ cursor: "pointer" }}
                                    >
                                        {scatterData.map((entry) => (
                                            <Cell
                                                key={entry.groupId}
                                                fill={SCATTER_COLORS[entry.verdict]}
                                            />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                            {(Object.entries(SCATTER_COLORS) as [keyof typeof SCATTER_COLORS, string][]).map(
                                ([v, c]) => (
                                    <span key={v} className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                                        {v}
                                    </span>
                                ),
                            )}
                            <span className="text-muted-foreground ml-2">
                                — แถบเป้า {fmtThb(SALES_TARGET_M2_LOW)}–{fmtThb(SALES_TARGET_M2_HIGH)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Alert feed */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Alert feed — ทั้งพอร์ต</CardTitle>
                        <CardDescription>เรียงความเร่งด่วน · คลิกไป Level 2</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[360px] overflow-y-auto">
                        {data.portfolioAlerts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">ไม่มี alert active</p>
                        ) : (
                            data.portfolioAlerts.map((a, i) => (
                                <button
                                    key={`${a.groupId}-${a.alertType}-${i}`}
                                    type="button"
                                    onClick={() => drillDown(a.groupId)}
                                    className={cn(
                                        "w-full text-left rounded-lg border p-3 text-sm hover:opacity-90 transition-opacity",
                                        ALERT_STYLE[a.alertType],
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <Badge variant="outline" className="text-xs shrink-0">
                                            {a.alertType}
                                        </Badge>
                                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    </div>
                                    <p className="font-medium mt-1 truncate">{a.label}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                                </button>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            <p className="text-xs text-muted-foreground text-center">
                ข้อมูล ณ {new Date(data.dataAsOf).toLocaleString("th-TH")} · cache 30 นาที ·{" "}
                <Link href="/analytics/new-overview" className="underline">
                    ภาพรวม Portfolio
                </Link>
            </p>
        </div>
    )
}
