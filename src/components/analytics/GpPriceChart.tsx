"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
} from "recharts"
import type { MonthlyGpPricePoint } from "@/lib/analytics/types"
import { fmtThb, fmtPctRaw } from "@/lib/analytics/format"

type GpMode = "ABS" | "PCT"

/** Pearson correlation between two equal-length series (ignoring null/empty months). */
function pearson(a: number[], b: number[]): number | null {
    const pairs = a
        .map((v, i) => [v, b[i]] as [number, number])
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    const n = pairs.length
    if (n < 3) return null
    const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
    const xs = pairs.map((p) => p[0])
    const ys = pairs.map((p) => p[1])
    const mx = mean(xs)
    const my = mean(ys)
    let num = 0
    let dx = 0
    let dy = 0
    for (let i = 0; i < n; i++) {
        num += (xs[i] - mx) * (ys[i] - my)
        dx += (xs[i] - mx) ** 2
        dy += (ys[i] - my) ** 2
    }
    if (dx === 0 || dy === 0) return null
    return num / Math.sqrt(dx * dy)
}

function corrLabel(r: number): { text: string; tone: string } {
    const abs = Math.abs(r)
    const dir = r >= 0 ? "เชิงบวก" : "เชิงลบ"
    let strength = "อ่อน"
    if (abs >= 0.7) strength = "สูง"
    else if (abs >= 0.4) strength = "ปานกลาง"
    const tone =
        abs < 0.4
            ? "bg-muted text-muted-foreground"
            : r >= 0
              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
              : "bg-amber-100 text-amber-800 border-amber-200"
    return { text: `ความสัมพันธ์${dir} (${strength}) r=${r.toFixed(2)}`, tone }
}

export function GpPriceChart({
    data,
    title = "GP trend vs Selling price",
    description = "รายเดือน (18 เดือน) · GP หลังหักช่องทาง · ราคาขายเฉลี่ย = รายได้ ÷ จำนวนชิ้น",
}: {
    data: { monthlyGpPrice: MonthlyGpPricePoint[] }
    title?: string
    description?: string
}) {
    const [gpMode, setGpMode] = useState<GpMode>("ABS")

    const rows = data.monthlyGpPrice.filter((m) => m.revenue > 0)

    const correlation = useMemo(() => {
        const gp = rows.map((m) =>
            gpMode === "ABS" ? m.grossProfit : (m.gmPct ?? NaN),
        )
        const price = rows.map((m) => m.avgSellPrice ?? NaN)
        return pearson(gp, price)
    }, [rows, gpMode])

    const insight = useMemo(() => {
        if (correlation == null) return "ข้อมูลยังไม่พอสำหรับวัดความสัมพันธ์"
        const { text } = corrLabel(correlation)
        if (correlation >= 0.4) {
            return `${text} — ราคาขายเฉลี่ยสูงขึ้นมักมาพร้อมกำไรที่เพิ่มขึ้น (กำไรมาจากราคา/มาร์จิน)`
        }
        if (correlation <= -0.4) {
            return `${text} — กำไรเพิ่มแม้ราคาขายเฉลี่ยลดลง (กำไรมาจากปริมาณ/ลดต้นทุน)`
        }
        return `${text} — กำไรและราคาขายไม่ได้เคลื่อนไหวไปด้วยกันชัดเจน`
    }, [correlation])

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant={gpMode === "ABS" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setGpMode("ABS")}
                        >
                            GP ฿
                        </Button>
                        <Button
                            variant={gpMode === "PCT" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setGpMode("PCT")}
                        >
                            GM %
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {correlation != null && (
                    <Badge variant="outline" className={corrLabel(correlation).tone}>
                        {insight}
                    </Badge>
                )}
                <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 10 }}
                                tickFormatter={(m: string) => m.slice(2)}
                            />
                            <YAxis
                                yAxisId="gp"
                                tick={{ fontSize: 10 }}
                                width={52}
                                tickFormatter={(v: number) =>
                                    gpMode === "ABS"
                                        ? `${(v / 1000).toFixed(0)}k`
                                        : `${v.toFixed(0)}%`
                                }
                            />
                            <YAxis
                                yAxisId="price"
                                orientation="right"
                                tick={{ fontSize: 10 }}
                                width={56}
                                tickFormatter={(v: number) => fmtThb(v)}
                            />
                            <Tooltip
                                formatter={(value, name) => {
                                    const v = Number(value ?? 0)
                                    if (name === "Avg sell price") return fmtThb(v)
                                    if (name === "GM %") return fmtPctRaw(v)
                                    return fmtThb(v)
                                }}
                            />
                            <Legend />
                            <Bar
                                yAxisId="gp"
                                dataKey={gpMode === "ABS" ? "grossProfit" : "gmPct"}
                                name={gpMode === "ABS" ? "Gross profit" : "GM %"}
                                fill="#10b981"
                                radius={3}
                            />
                            <Line
                                yAxisId="price"
                                type="monotone"
                                dataKey="avgSellPrice"
                                name="Avg sell price"
                                stroke="#6366f1"
                                strokeWidth={2}
                                dot={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-muted-foreground">
                    แท่งเขียว = {gpMode === "ABS" ? "กำไรขั้นต้น (฿)" : "อัตรากำไร (%)"} (แกนซ้าย) ·
                    เส้นม่วง = ราคาขายเฉลี่ย (แกนขวา). r = ค่าสหสัมพันธ์ Pearson ระหว่าง 2 เส้น
                </p>
            </CardContent>
        </Card>
    )
}
