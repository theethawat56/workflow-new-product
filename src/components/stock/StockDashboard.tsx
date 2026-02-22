"use client"

import { useState, useMemo } from "react"
import { AlertTriangle, Package, CheckCircle, XCircle, TrendingDown, Clock, Filter, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

interface StockItem {
    STATUS: string
    SKU: string
    "Product Name": string
    "Current Stock": string | number
    "Safety Stock pcs": string | number
    "Day inventory outstanding": string | number
}

interface Props {
    items: StockItem[]
}

function parseNum(val: string | number): number {
    const n = Number(String(val ?? "").replace(/,/g, "").trim())
    return isNaN(n) ? 0 : n
}

// Only show items with a non-empty STATUS column
function hasStatus(item: StockItem): boolean {
    return !!(item.STATUS && String(item.STATUS).trim() !== "")
}

// Auto-calculate status from Current Stock vs Safety Stock pcs + DIO
function calcStatus(item: StockItem): "oos" | "low" | "ok" {
    const stock = parseNum(item["Current Stock"])
    const safety = parseNum(item["Safety Stock pcs"])
    const dio = parseNum(item["Day inventory outstanding"])

    if (stock <= 0 || dio <= 0) return "oos"
    if (stock <= safety) return "low"
    return "ok"
}

type StatusKey = "oos" | "low" | "ok"

const STATUS_CONFIG: Record<StatusKey, {
    label: string; bg: string; header: string; badge: string;
    stockColor: string; icon: any; iconColor: string; dot: string;
    sectionBg: string; sectionBorder: string; kpiBg: string; kpiRing: string;
}> = {
    oos: {
        label: "Out of Stock",
        bg: "bg-red-50 border-red-300",
        header: "bg-red-500",
        badge: "bg-red-100 text-red-700 border border-red-300",
        stockColor: "text-red-600",
        icon: XCircle,
        iconColor: "text-red-600",
        dot: "bg-red-500",
        sectionBg: "bg-red-50/60",
        sectionBorder: "border-red-200",
        kpiBg: "bg-red-50 hover:bg-red-100",
        kpiRing: "ring-red-400",
    },
    low: {
        label: "Low Stock",
        bg: "bg-amber-50 border-amber-300",
        header: "bg-amber-400",
        badge: "bg-amber-100 text-amber-700 border border-amber-300",
        stockColor: "text-amber-600",
        icon: AlertTriangle,
        iconColor: "text-amber-600",
        dot: "bg-amber-400",
        sectionBg: "bg-amber-50/60",
        sectionBorder: "border-amber-200",
        kpiBg: "bg-amber-50 hover:bg-amber-100",
        kpiRing: "ring-amber-400",
    },
    ok: {
        label: "Healthy Stock",
        bg: "bg-green-50 border-green-200",
        header: "bg-green-500",
        badge: "bg-green-100 text-green-700 border border-green-300",
        stockColor: "text-green-700",
        icon: CheckCircle,
        iconColor: "text-green-600",
        dot: "bg-green-500",
        sectionBg: "bg-green-50/40",
        sectionBorder: "border-green-200",
        kpiBg: "bg-green-50 hover:bg-green-100",
        kpiRing: "ring-green-400",
    },
}

function StockCard({ item }: { item: StockItem & { _status: StatusKey } }) {
    const cfg = STATUS_CONFIG[item._status]
    const stock = parseNum(item["Current Stock"])
    const safety = parseNum(item["Safety Stock pcs"])
    const dio = parseNum(item["Day inventory outstanding"])

    return (
        <div className={`rounded-xl border-2 ${cfg.bg} overflow-hidden shadow-sm flex flex-col`}>
            <div className={`h-1.5 w-full ${cfg.header}`} />
            <div className="p-4 flex flex-col gap-3 flex-1">
                {/* Status badge + SKU */}
                <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono bg-white/70 border rounded px-1.5 py-0.5 shrink-0">
                        {item.SKU || "—"}
                    </span>
                </div>

                {/* Product name */}
                <p className="text-sm font-semibold leading-tight line-clamp-2">
                    {item["Product Name"] || "—"}
                </p>

                {/* Current Stock — big number */}
                <div className="mt-auto">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Stock</p>
                    <p className={`text-3xl font-black tabular-nums leading-none mt-0.5 ${cfg.stockColor}`}>
                        {stock.toLocaleString()}
                        <span className="text-xs font-normal text-muted-foreground ml-1">pcs</span>
                    </p>
                </div>

                <div className="border-t border-dashed opacity-20" />

                {/* Reorder point + Days left */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/60 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-0.5">
                            <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Reorder Point</p>
                        </div>
                        <p className={`text-base font-bold tabular-nums ${stock <= safety && item._status !== "oos" ? "text-amber-600" : "text-foreground"}`}>
                            {safety > 0 ? safety.toLocaleString() : "—"}
                            {safety > 0 && <span className="text-[10px] font-normal text-muted-foreground ml-0.5">pcs</span>}
                        </p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-0.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">Days Left</p>
                        </div>
                        <p className={`text-base font-bold tabular-nums ${dio <= 0 ? "text-red-600" : dio <= 14 ? "text-amber-600" : "text-foreground"}`}>
                            {dio > 0 ? Math.round(dio) : "0"}
                            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">days</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SectionHeader({ status, count, dimmed }: { status: StatusKey; count: number; dimmed: boolean }) {
    const cfg = STATUS_CONFIG[status]
    const Icon = cfg.icon
    return (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-opacity ${cfg.sectionBg} ${cfg.sectionBorder} ${dimmed ? "opacity-40" : "opacity-100"}`}>
            <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
            <span className={`font-semibold text-sm ${cfg.iconColor}`}>{cfg.label}</span>
            <span className="text-xs text-muted-foreground">— {count} SKU{count !== 1 ? "s" : ""}</span>
        </div>
    )
}

export function StockDashboard({ items }: Props) {
    const [activeFilter, setActiveFilter] = useState<StatusKey | null>(null)
    const [search, setSearch] = useState("")

    // Filter to only items that have a STATUS value in the sheet
    const validItems = useMemo(() => items.filter(hasStatus), [items])

    const enriched = useMemo(() => {
        const q = search.toLowerCase().trim()
        return validItems
            .filter(item =>
                !q ||
                (item["Product Name"] || "").toLowerCase().includes(q) ||
                (item.SKU || "").toLowerCase().includes(q)
            )
            .map(item => ({ ...item, _status: calcStatus(item) as StatusKey }))
            .sort((a, b) => {
                const order: Record<StatusKey, number> = { oos: 0, low: 1, ok: 2 }
                return order[a._status] - order[b._status]
            })
    }, [validItems, search])

    const oosItems = enriched.filter(i => i._status === "oos")
    const lowItems = enriched.filter(i => i._status === "low")
    const okItems = enriched.filter(i => i._status === "ok")
    const totalUnits = enriched.reduce((s, i) => s + parseNum(i["Current Stock"]), 0)

    const handleKpiClick = (key: StatusKey) => {
        setActiveFilter(prev => prev === key ? null : key)
    }

    const isFiltered = activeFilter !== null

    const kpiCards = [
        { key: null as null, icon: Package, label: "Total SKUs", value: validItems.length, sub: `${totalUnits.toLocaleString()} units`, color: "text-slate-700", iconBg: "bg-slate-100", kpiBg: "bg-slate-50 hover:bg-slate-100", kpiRing: "ring-slate-400" },
        { key: "oos" as StatusKey, icon: XCircle, label: "Out of Stock", value: oosItems.length, sub: "needs restocking now", color: STATUS_CONFIG.oos.iconColor, iconBg: "bg-red-100", kpiBg: STATUS_CONFIG.oos.kpiBg, kpiRing: STATUS_CONFIG.oos.kpiRing },
        { key: "low" as StatusKey, icon: AlertTriangle, label: "Low Stock", value: lowItems.length, sub: "below safety stock", color: STATUS_CONFIG.low.iconColor, iconBg: "bg-amber-100", kpiBg: STATUS_CONFIG.low.kpiBg, kpiRing: STATUS_CONFIG.low.kpiRing },
        { key: "ok" as StatusKey, icon: CheckCircle, label: "Healthy", value: okItems.length, sub: "stock levels OK", color: STATUS_CONFIG.ok.iconColor, iconBg: "bg-green-100", kpiBg: STATUS_CONFIG.ok.kpiBg, kpiRing: STATUS_CONFIG.ok.kpiRing },
    ]

    return (
        <div className="space-y-6">

            {/* ── KPI Cards (clickable to filter) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {kpiCards.map(({ key, icon: Icon, label, value, sub, color, iconBg, kpiBg, kpiRing }) => {
                    const isActive = key !== null && activeFilter === key
                    return (
                        <button
                            key={label}
                            onClick={() => key !== null && handleKpiClick(key)}
                            className={`rounded-xl border text-left shadow-sm p-4 flex items-start gap-3 transition-all duration-200
                                ${kpiBg}
                                ${key !== null ? "cursor-pointer" : "cursor-default"}
                                ${isActive ? `ring-2 ${kpiRing} shadow-md scale-[1.02]` : ""}
                            `}
                        >
                            <div className={`p-2 rounded-lg ${iconBg} shrink-0`}>
                                <Icon className={`h-4 w-4 ${color}`} />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className={`text-2xl font-black ${color}`}>{value}</p>
                                <p className="text-[10px] text-muted-foreground">{sub}</p>
                            </div>
                            {isActive && (
                                <span className="ml-auto mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/80 border text-muted-foreground flex items-center gap-0.5">
                                    <Filter className="h-2.5 w-2.5" /> ON
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Search bar ── */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search SKU or product name…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 pr-9 bg-white"
                />
                {search && (
                    <button
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Active filter chip */}
            {isFiltered && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    Showing <strong className="text-foreground">{STATUS_CONFIG[activeFilter!].label}</strong> only
                    <button
                        onClick={() => setActiveFilter(null)}
                        className="ml-1 text-xs underline hover:text-foreground"
                    >
                        Clear filter
                    </button>
                </div>
            )}

            {/* ── Alert banner ── */}
            {(oosItems.length > 0 || lowItems.length > 0) && !isFiltered && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <TrendingDown className="h-5 w-5 shrink-0" />
                    <span>
                        <strong>{oosItems.length} SKUs out of stock</strong> and <strong>{lowItems.length} SKUs below safety stock</strong> — consider placing orders.
                    </span>
                </div>
            )}

            {/* ── Out of Stock Section ── */}
            {oosItems.length > 0 && (!isFiltered || activeFilter === "oos") && (
                <div className={`space-y-3 transition-opacity ${isFiltered && activeFilter !== "oos" ? "opacity-30 pointer-events-none" : ""}`}>
                    <SectionHeader status="oos" count={oosItems.length} dimmed={false} />
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {oosItems.map((item, i) => <StockCard key={i} item={item} />)}
                    </div>
                </div>
            )}

            {/* ── Low Stock Section ── */}
            {lowItems.length > 0 && (!isFiltered || activeFilter === "low") && (
                <div className={`space-y-3 transition-opacity ${isFiltered && activeFilter !== "low" ? "opacity-30 pointer-events-none" : ""}`}>
                    <SectionHeader status="low" count={lowItems.length} dimmed={false} />
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {lowItems.map((item, i) => <StockCard key={i} item={item} />)}
                    </div>
                </div>
            )}

            {/* ── OK Section ── */}
            {okItems.length > 0 && (!isFiltered || activeFilter === "ok") && (
                <div className={`space-y-3 transition-opacity ${isFiltered && activeFilter !== "ok" ? "opacity-30 pointer-events-none" : ""}`}>
                    <SectionHeader status="ok" count={okItems.length} dimmed={false} />
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {okItems.map((item, i) => <StockCard key={i} item={item} />)}
                    </div>
                </div>
            )}

            {validItems.length === 0 && (
                <div className="text-center py-24 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No stock data with a STATUS value found in the Stock_AT sheet.</p>
                </div>
            )}
        </div>
    )
}
