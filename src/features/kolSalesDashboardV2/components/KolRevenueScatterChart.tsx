"use client"

import { SkuImpactRow } from "../types"
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMemo } from "react"

interface Props {
    data: SkuImpactRow[]
    onSkuClick?: (sku: string) => void
}

export function KolRevenueScatterChart({ data, onSkuClick }: Props) {
    // 1. Prepare Data
    const chartData = useMemo(() => {
        return data.map(item => ({
            ...item,
            // Fallbacks for safety
            uniqueKols: item.uniqueKols || 0,
            revenue: item.revenue || 0,
            budget: item.budget || 0,
            costPct: item.costPct ?? 0 // Treat null as 0 for coloring? Or distinct?
        })).filter(d => d.revenue > 0 || d.uniqueKols > 0) // Hide empty rows
    }, [data])

    // 2. Calculate Medians for Quadrants
    const { medianX, medianY, maxX, maxY } = useMemo(() => {
        if (chartData.length === 0) return { medianX: 0, medianY: 0, maxX: 0, maxY: 0 }

        const sortedX = [...chartData].sort((a, b) => a.uniqueKols - b.uniqueKols)
        const sortedY = [...chartData].sort((a, b) => a.revenue - b.revenue)
        const mid = Math.floor(chartData.length / 2)

        return {
            medianX: sortedX[mid].uniqueKols,
            medianY: sortedY[mid].revenue,
            maxX: sortedX[sortedX.length - 1].uniqueKols,
            maxY: sortedY[sortedY.length - 1].revenue
        }
    }, [chartData])

    // 3. Color Scale Helper
    const getColor = (costPct: number) => {
        if (costPct === 0 && costPct !== null) return "#9ca3af" // Grey for 0 cost? Or 0 revenue?
        if (costPct < 10) return "#22c55e" // Green (Efficient)
        if (costPct < 25) return "#eab308" // Yellow (Medium)
        return "#ef4444" // Red (Expensive)
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload
            return (
                <div className="bg-popover border text-popover-foreground p-2 rounded shadow-md text-xs">
                    <p className="font-bold mb-1">{d.productName}</p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <span>SKU:</span> <span className="font-mono">{d.sku}</span>
                        <span>Revenue:</span> <span>฿{d.revenue.toLocaleString()}</span>
                        <span>Budget:</span> <span>฿{d.budget.toLocaleString()}</span>
                        <span>Cost %:</span> <span className={d.costPct > 25 ? "text-red-500 font-bold" : "text-green-500 font-bold"}>{d.costPct?.toFixed(1)}%</span>
                        <span>Unique KOLs:</span> <span>{d.uniqueKols}</span>
                        <span>Posts:</span> <span>{d.posts}</span>
                        <span>Views:</span> <span>{d.views.toLocaleString()}</span>
                    </div>
                </div>
            )
        }
        return null
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Performance Matrix (KOLs vs Revenue)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[500px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart
                            margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

                            {/* X Axis: KOL Count */}
                            <XAxis
                                type="number"
                                dataKey="uniqueKols"
                                name="Unique KOLs"
                                unit=""
                                tick={{ fontSize: 12 }}
                                label={{ value: "Unique KOLs", position: "bottom", offset: 20 }}
                            />

                            {/* Y Axis: Revenue */}
                            <YAxis
                                type="number"
                                dataKey="revenue"
                                name="Revenue"
                                unit="฿"
                                tickFormatter={(val: any) => `฿${(val / 1000).toFixed(0)}k`}
                                tick={{ fontSize: 12 }}
                                label={{ value: "Revenue", angle: -90, position: "left", offset: 40 }}
                            />

                            {/* Z Axis: Budget (Bubble Size) */}
                            <ZAxis type="number" dataKey="budget" range={[50, 600]} name="Budget" />

                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

                            {/* Quadrant Lines */}
                            {chartData.length > 0 && (
                                <>
                                    <ReferenceLine x={medianX} stroke="#6b7280" strokeDasharray="3 3">
                                        <Label value="High KOLs ->" position="insideTopRight" fontSize={10} fill="#6b7280" />
                                    </ReferenceLine>
                                    <ReferenceLine y={medianY} stroke="#6b7280" strokeDasharray="3 3">
                                        <Label value="High Rev ^" position="insideTopRight" fontSize={10} fill="#6b7280" />
                                    </ReferenceLine>
                                </>
                            )}

                            <Scatter
                                name="Products"
                                data={chartData}
                                fill="#8884d8"
                                cursor="pointer"
                                onClick={(p) => onSkuClick?.(p.sku)}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={getColor(entry.costPct)} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend / Guide */}
                <div className="flex gap-4 justify-center text-xs text-muted-foreground mt-2">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div> Efficient (&lt;10%)</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> Medium (10-25%)</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Expensive (&gt;25%)</div>
                    <div className="flex items-center gap-1 ml-4">Bubble Size = Budget</div>
                </div>
            </CardContent>
        </Card>
    )
}
