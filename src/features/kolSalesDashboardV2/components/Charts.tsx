"use client"

import { TimeSeriesPoint, DashboardMode } from "../types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

export function Charts({ data, mode }: { data: TimeSeriesPoint[], mode: DashboardMode }) {

    // Formatting
    const fmtY = (val: number) => {
        if (val >= 1000) return `${(val / 1000).toFixed(1)}k`
        return val.toString()
    }
    const fmtDate = (d: string) => {
        try {
            const date = new Date(d)
            if (isNaN(date.getTime())) return d
            return `${date.getDate()}/${date.getMonth() + 1}`
        } catch { return d }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm">Revenue vs Budget Trend</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[500px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 30, bottom: 60, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={fmtDate}
                                fontSize={12}
                                tickLine={false}
                                angle={-45}
                                textAnchor="end"
                                interval="preserveStartEnd"
                                dy={10}
                            />
                            <YAxis
                                yAxisId="left"
                                tickFormatter={fmtY}
                                fontSize={12}
                                orientation="left"
                                stroke="#16a34a"
                                label={{ value: "Revenue", angle: -90, position: "insideLeft", offset: 0, style: { fill: '#16a34a' } }}
                            />
                            <YAxis
                                yAxisId="right"
                                fontSize={12}
                                orientation="right"
                                stroke="#2563eb"
                                tickFormatter={(val: any) => fmtY(val || 0)}
                                label={{ value: "Budget", angle: 90, position: "insideRight", offset: 0, style: { fill: '#2563eb' } }}
                            />
                            <Tooltip
                                labelFormatter={v => new Date(v).toLocaleDateString()}
                                formatter={(val: any) => val ? val.toLocaleString() : "0"}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Bar
                                yAxisId="right"
                                dataKey="budget"
                                name="Budget"
                                fill="#93c5fd"
                                barSize={20}
                                radius={[4, 4, 0, 0]}
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="revenue"
                                name={mode === "ATTRIBUTION" ? "Attrib. Rev" : "Revenue"}
                                stroke="#16a34a"
                                strokeWidth={3}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
