"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, Package, CheckCircle, XCircle, Search, TrendingDown } from "lucide-react"

interface StockItem {
    STATUS: string
    SKU: string
    "Product Name": string
    "Current Stock": string | number
}

interface Props {
    items: StockItem[]
}

function parseStock(val: string | number): number {
    const n = Number(String(val).replace(/,/g, ""))
    return isNaN(n) ? 0 : n
}

function getStatusMeta(status: string) {
    const s = (status || "").toUpperCase().trim()
    if (s === "OUT OF STOCK" || s === "OOS" || s === "OUT_OF_STOCK")
        return { label: "Out of Stock", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", priority: 0 }
    if (s === "LOW" || s === "LOW STOCK" || s === "LOW_STOCK")
        return { label: "Low Stock", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", priority: 1 }
    if (s === "OK" || s === "NORMAL" || s === "HEALTHY" || s === "IN STOCK" || s === "ACTIVE")
        return { label: "OK", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", priority: 2 }
    return { label: status || "Unknown", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400", priority: 3 }
}

const STATUS_FILTERS = ["All", "Out of Stock", "Low Stock", "OK"]

export function StockDashboard({ items }: Props) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("All")

    // ── KPI summary ─────────────────────────────────────────────────────────
    const summary = useMemo(() => {
        const total = items.length
        const outOfStock = items.filter(i => getStatusMeta(i.STATUS).priority === 0).length
        const lowStock = items.filter(i => getStatusMeta(i.STATUS).priority === 1).length
        const ok = items.filter(i => getStatusMeta(i.STATUS).priority === 2).length
        const totalUnits = items.reduce((sum, i) => sum + parseStock(i["Current Stock"]), 0)
        return { total, outOfStock, lowStock, ok, totalUnits }
    }, [items])

    // ── Filtered list ────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        return items
            .filter(item => {
                const matchSearch =
                    (item["Product Name"] || "").toLowerCase().includes(search.toLowerCase()) ||
                    (item.SKU || "").toLowerCase().includes(search.toLowerCase())
                const meta = getStatusMeta(item.STATUS)
                const matchStatus = statusFilter === "All" || meta.label === statusFilter
                return matchSearch && matchStatus
            })
            // Sort: Out of Stock first, then Low, then OK
            .sort((a, b) => getStatusMeta(a.STATUS).priority - getStatusMeta(b.STATUS).priority)
    }, [items, search, statusFilter])

    return (
        <div className="space-y-6">
            {/* ── KPI Cards ── */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" /> Total SKUs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{summary.total}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">{summary.totalUnits.toLocaleString()} units total</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-red-600 uppercase tracking-wide flex items-center gap-1.5">
                            <XCircle className="h-3.5 w-3.5" /> Out of Stock
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">{summary.outOfStock}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">needs restocking now</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-amber-600 uppercase tracking-wide flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-600">{summary.lowStock}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">consider ordering soon</p>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-green-600 uppercase tracking-wide flex items-center gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5" /> Healthy Stock
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{summary.ok}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">stock levels are OK</p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Alert banner if OOS or Low ── */}
            {(summary.outOfStock > 0 || summary.lowStock > 0) && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <TrendingDown className="h-5 w-5 shrink-0" />
                    <span>
                        <strong>{summary.outOfStock} SKUs</strong> are out of stock and <strong>{summary.lowStock} SKUs</strong> are running low.
                        {" "}Consider placing orders soon to avoid stockouts.
                    </span>
                </div>
            )}

            {/* ── Filter & Search ── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search SKU or product name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-1 bg-muted/30 border rounded-lg p-1">
                    {STATUS_FILTERS.map(f => (
                        <Button
                            key={f}
                            size="sm"
                            variant={statusFilter === f ? "secondary" : "ghost"}
                            className="h-7 text-xs"
                            onClick={() => setStatusFilter(f)}
                        >
                            {f}
                            {f !== "All" && (
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                    ({items.filter(i => getStatusMeta(i.STATUS).label === f).length})
                                </span>
                            )}
                        </Button>
                    ))}
                </div>
                <div className="text-sm text-muted-foreground ml-auto">
                    {filtered.length} of {items.length} items
                </div>
            </div>

            {/* ── Table ── */}
            <Card className="border shadow-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/20">
                                <TableHead className="w-[140px]">Status</TableHead>
                                <TableHead className="w-[120px]">SKU</TableHead>
                                <TableHead>Product Name</TableHead>
                                <TableHead className="text-right w-[140px]">Current Stock</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        No products match your filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((item, idx) => {
                                    const meta = getStatusMeta(item.STATUS)
                                    const stock = parseStock(item["Current Stock"])
                                    return (
                                        <TableRow key={idx} className={
                                            meta.priority === 0 ? "bg-red-50/40" :
                                                meta.priority === 1 ? "bg-amber-50/30" : ""
                                        }>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-xs font-medium ${meta.color} flex items-center gap-1.5 w-fit`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                                    {meta.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm font-medium text-muted-foreground">
                                                {item.SKU || "—"}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {item["Product Name"] || "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={`font-bold text-base tabular-nums ${meta.priority === 0 ? "text-red-600" :
                                                        meta.priority === 1 ? "text-amber-600" :
                                                            "text-green-700"
                                                    }`}>
                                                    {stock.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-1">units</span>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
