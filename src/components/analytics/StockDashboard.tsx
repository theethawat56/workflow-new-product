"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    LineChart,
    Line,
    ResponsiveContainer,
} from "recharts"
import type { AnalyticsOverview, StockSkuMetrics, StockStatus } from "@/lib/analytics/types"
import {
    DEFAULT_LEAD_TIME,
    Z_BY_SERVICE,
    stockStatus,
} from "@/lib/analytics/constants"
import { fmtNum } from "@/lib/analytics/format"
import { SkuLink } from "@/components/analytics/SkuLink"
import { Settings2 } from "lucide-react"

const STATUS_ORDER: Record<StockStatus, number> = {
    "REORDER NOW": 0,
    WATCH: 1,
    OK: 2,
    UNKNOWN: 3,
}

const STATUS_STYLE: Record<StockStatus, string> = {
    "REORDER NOW": "bg-red-100 text-red-800 border-red-300",
    WATCH: "bg-amber-100 text-amber-800 border-amber-300",
    OK: "bg-emerald-100 text-emerald-800 border-emerald-300",
    UNKNOWN: "bg-muted text-muted-foreground",
}

const LAUNCH_YEAR_STYLE: Record<2025 | 2026, string> = {
    2026: "bg-emerald-100 text-emerald-800 border-emerald-200",
    2025: "bg-sky-100 text-sky-800 border-sky-200",
}

export function StockDashboard({ data }: { data: AnalyticsOverview }) {
    const [leadTime, setLeadTime] = useState(DEFAULT_LEAD_TIME)
    const [serviceLevel, setServiceLevel] = useState<90 | 95 | 99>(90)

    const z = Z_BY_SERVICE[serviceLevel]

    const rows = useMemo(() => {
        return data.stockSkus
            .map((base) => {
                const recomputed = {
                    ...base,
                    safetyStock: z * base.dailyStd * Math.sqrt(leadTime),
                    reorderPoint:
                        base.dailyAvg * leadTime +
                        z * base.dailyStd * Math.sqrt(leadTime),
                    minOrderQty: base.dailyAvg * leadTime,
                }
                const currentStock = base.currentStock
                const status = stockStatus(currentStock, recomputed.reorderPoint)
                const coverDays =
                    currentStock != null && base.dailyAvg > 0
                        ? currentStock / base.dailyAvg
                        : null
                return { ...recomputed, currentStock, status, coverDays }
            })
            .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    }, [data, leadTime, z])

    const counts = rows.reduce(
        (acc, r) => {
            acc[r.status] = (acc[r.status] ?? 0) + 1
            return acc
        },
        {} as Record<StockStatus, number>,
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2 flex-wrap">
                    <Badge className={STATUS_STYLE["REORDER NOW"]}>
                        REORDER: {counts["REORDER NOW"] ?? 0}
                    </Badge>
                    <Badge className={STATUS_STYLE.WATCH}>WATCH: {counts.WATCH ?? 0}</Badge>
                    <Badge className={STATUS_STYLE.OK}>OK: {counts.OK ?? 0}</Badge>
                    <Badge variant="outline">
                        No Stock_AT match: {counts.UNKNOWN ?? 0}
                    </Badge>
                </div>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Settings2 className="w-4 h-4 mr-2" />
                            ROP settings
                        </Button>
                    </SheetTrigger>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Reorder parameters</SheetTitle>
                        </SheetHeader>
                        <div className="space-y-4 mt-6">
                            <div>
                                <Label>Lead time (days)</Label>
                                <Input
                                    type="number"
                                    value={leadTime}
                                    onChange={(e) => setLeadTime(Number(e.target.value) || 45)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Service level</Label>
                                <Select
                                    value={String(serviceLevel)}
                                    onValueChange={(v) =>
                                        setServiceLevel(Number(v) as 90 | 95 | 99)
                                    }
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="90">90% (Z=1.28)</SelectItem>
                                        <SelectItem value="95">95% (Z=1.65)</SelectItem>
                                        <SelectItem value="99">99% (Z=2.33)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                ROP = daily_avg × LT + Z × σ × √LT. Higher service level raises all
                                ROPs.
                            </p>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Reorder dashboard</CardTitle>
                    <CardDescription>
                        Last 90 days through {data.dataAsOf} · stock from Stock_AT · LT=
                        {leadTime}d · Z={z}
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>SKU / Name</TableHead>
                                <TableHead className="text-right">daily_avg</TableHead>
                                <TableHead className="text-right">σ</TableHead>
                                <TableHead className="text-right">safety</TableHead>
                                <TableHead className="text-right font-semibold">ROP</TableHead>
                                <TableHead className="text-right">min order</TableHead>
                                <TableHead className="w-[90px]">stock</TableHead>
                                <TableHead className="text-right">cover d</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[100px]">90d</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r) => (
                                <StockRow
                                    key={r.sku}
                                    row={r}
                                    spark={
                                        data.stockSkus.find((s) => s.sku === r.sku)
                                            ?.dailyUnits90 ?? []
                                    }
                                />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

function StockRow({
    row,
    spark,
}: {
    row: StockSkuMetrics & {
        currentStock: number | null
        status: StockStatus
        coverDays: number | null
        reorderPoint: number
        minOrderQty: number
        safetyStock: number
    }
    spark: number[]
}) {
    const sparkData = spark.map((v, i) => ({ i, v }))
    return (
        <TableRow>
            <TableCell>
                <SkuLink sku={row.sku} className="font-mono text-xs" />
                <div className="text-sm truncate max-w-[180px]">{row.productName}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                    {row.launchYear != null && (
                        <Badge
                            variant="outline"
                            className={`text-[10px] py-0 h-5 ${LAUNCH_YEAR_STYLE[row.launchYear]}`}
                        >
                            Launch {row.launchYear}
                        </Badge>
                    )}
                </div>
                {row.seasonality === "SEASONAL (summer)" && (
                    <span
                        className="text-[10px] text-amber-700"
                        title="Raise ROP before Mar; reduce after Jul"
                    >
                        ☀ seasonal
                    </span>
                )}
            </TableCell>
            <TableCell className="text-right">{fmtNum(row.dailyAvg, 2)}</TableCell>
            <TableCell className="text-right">{fmtNum(row.dailyStd, 2)}</TableCell>
            <TableCell className="text-right">{fmtNum(row.safetyStock, 0)}</TableCell>
            <TableCell className="text-right font-semibold">
                {fmtNum(row.reorderPoint, 0)}
            </TableCell>
            <TableCell className="text-right">{fmtNum(row.minOrderQty, 0)}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">
                {row.currentStock != null ? fmtNum(row.currentStock, 0) : "—"}
            </TableCell>
            <TableCell className="text-right">
                {row.coverDays != null ? fmtNum(row.coverDays, 1) : "—"}
            </TableCell>
            <TableCell>
                <Badge variant="outline" className={STATUS_STYLE[row.status]}>
                    {row.status}
                </Badge>
            </TableCell>
            <TableCell>
                <div className="h-8 w-24">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkData}>
                            <Line
                                type="monotone"
                                dataKey="v"
                                stroke="#6366f1"
                                dot={false}
                                strokeWidth={1}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </TableCell>
        </TableRow>
    )
}
