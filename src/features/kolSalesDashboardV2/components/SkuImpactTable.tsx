"use client"

import { SkuImpactRow, DashboardMode } from "../types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { ArrowUpDown, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts"

export function SkuImpactTable({ rows, mode, trendBuckets = [] }: { rows: SkuImpactRow[], mode: DashboardMode, trendBuckets?: string[] }) {
    const [sort, setSort] = useState<{ k: keyof SkuImpactRow | "costPct", dir: "asc" | "desc" }>({ k: "costPct", dir: "desc" })

    const isAttrib = mode === "ATTRIBUTION"

    const sorted = [...rows].sort((a, b) => {
        let valA = a[sort.k] as number
        let valB = b[sort.k] as number

        // Handle N/A
        if (valA === null || valA === undefined) valA = -999999
        if (valB === null || valB === undefined) valB = -999999

        // Override for CostPct in Attrib mode
        if (sort.k === "costPct" && isAttrib) {
            valA = a.attributedCostPct ?? -1
            valB = b.attributedCostPct ?? -1
        }

        return sort.dir === "asc" ? valA - valB : valB - valA
    })

    const handleSort = (k: keyof SkuImpactRow | "costPct") => {
        setSort(prev => ({ k, dir: prev.k === k && prev.dir === "desc" ? "asc" : "desc" }))
    }

    const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })

    return (
        <div className="w-full">
            <div className="p-4 border-b bg-muted/10">
                <h3 className="font-semibold">SKU Impact Analysis</h3>
            </div>
            <div className="max-h-[600px] overflow-auto">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead>Product Name</TableHead>
                            <TableHead>SKU</TableHead>
                            <H onClick={() => handleSort("revenue")}>{isAttrib ? "Attrib. Rev" : "Revenue"}</H>
                            <H onClick={() => handleSort("budget")}>Budget</H>
                            <H onClick={() => handleSort("costPct")}>Cost %</H>
                            <H onClick={() => handleSort("costPctTrendDeltaPP")}>Cost Trend</H>
                            <H onClick={() => handleSort("posts")}>Posts</H>
                            <H onClick={() => handleSort("views")}>Views</H>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.map(row => {
                            const rev = isAttrib ? (row.attributedRevenue || 0) : row.revenue
                            const cp = isAttrib ? row.attributedCostPct : row.costPct

                            // Color code cost pct
                            let badgeColor = "bg-green-100 text-green-800"
                            if (cp === null || cp === undefined) badgeColor = "bg-gray-100 text-gray-800"
                            else if (cp > 50) badgeColor = "bg-red-100 text-red-800"
                            else if (cp > 20) badgeColor = "bg-yellow-100 text-yellow-800"

                            // Trend Logic
                            const delta = row.costPctTrendDeltaPP
                            const direction = row.costPctTrendDirection
                            let trendColor = "text-gray-500"
                            let TrendIcon = Minus
                            if (direction === "UP") { trendColor = "text-red-500"; TrendIcon = TrendingUp } // Cost UP is BAD? Usually yes.
                            if (direction === "DOWN") { trendColor = "text-green-500"; TrendIcon = TrendingDown } // Cost DOWN is GOOD.

                            const sparkData = row.costPctTrendSeries?.map((v, i) => ({ val: v, label: trendBuckets[i] })) || []

                            return (
                                <TableRow key={row.sku}>
                                    <TableCell className="font-medium max-w-[200px] truncate" title={row.productName}>
                                        {row.productName}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                                    <TableCell className="text-right">฿{fmt(rev)}</TableCell>
                                    <TableCell className="text-right">฿{fmt(row.budget)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`font-mono border-0 ${badgeColor}`}>
                                            {(cp !== null && cp !== undefined) ? `${cp.toFixed(1)}%` : "N/A"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="w-[140px]">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="h-[24px] w-[100px]">
                                                {sparkData.length > 0 ? (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={sparkData}>
                                                            <Line type="monotone" dataKey="val" stroke={direction === "DOWN" ? "#22c55e" : (direction === "UP" ? "#ef4444" : "#9ca3af")} dot={false} strokeWidth={2} />
                                                            <Tooltip
                                                                contentStyle={{ fontSize: '10px', padding: '4px' }}
                                                                formatter={(val: any) => (typeof val === 'number') ? val.toFixed(1) + "%" : "N/A"}
                                                                labelFormatter={(label) => label}
                                                            />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                ) : <span className="text-xs text-muted-foreground">-</span>}
                                            </div>
                                            <div className={`flex items-center text-xs font-semibold ${trendColor}`}>
                                                {delta !== null ? (
                                                    <>
                                                        <TrendIcon className="w-3 h-3 mr-1" />
                                                        {delta > 0 ? "+" : ""}{delta.toFixed(1)}pp
                                                    </>
                                                ) : <span className="text-muted-foreground font-normal">N/A</span>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">{row.posts}</TableCell>
                                    <TableCell className="text-right">{fmt(row.views)}</TableCell>
                                </TableRow>
                            )
                        })}
                        {sorted.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    No Data
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

function H({ children, onClick }: any) {
    return (
        <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors text-right" onClick={onClick}>
            <div className="flex items-center justify-end gap-1">
                {children}
                <ArrowUpDown className="h-3 w-3 opacity-50" />
            </div>
        </TableHead>
    )
}
