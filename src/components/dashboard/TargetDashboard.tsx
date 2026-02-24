"use client"

import React, { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Sun, Calendar, BarChart3, TrendingUp, TrendingDown, DollarSign, Package, AlertCircle, Activity } from "lucide-react"

// Types matching the user's description
interface TargetDashboardProps {
    salesData: any[]
    productsData: any[]
}

// --- Constants & Config ---
const TARGETS = {
    SAFE_GP_YEAR: 24470000,
    STRETCH_GP_YEAR: 27700000,
    TOTAL_SKUS: 24,
    MODELED_UNITS_YEAR: 1310,
    BASELINE_GP_PCT: 47.3,
    SAFE_GP_PER_DAY: 24470000 / 365,
    STRETCH_GP_PER_DAY: 27700000 / 365,
}

const MONTHS_CONFIG = [
    { id: 1, name: "JAN", days: 31, budget: 850000, units: 320, gp: 560000, skus: 4, label: "FUTURE" },
    { id: 2, name: "FEB", days: 28, budget: 920000, units: 140, gp: 520000, skus: 2, label: "NEXT" },
    { id: 3, name: "MAR", days: 31, budget: 1100000, units: 450, gp: 680000, skus: 10, label: "PREP NOW" },
    { id: 4, name: "APR", days: 30, budget: 500000, units: 400, gp: 270000, skus: 8, label: "FUTURE" },
]

export function TargetDashboard({ salesData, productsData }: TargetDashboardProps) {
    const [viewMode, setViewMode] = useState<"daily" | "annual">("daily")
    const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly">("daily")

    // Auto-detect current month (1-4)
    const currentMonthIndex = useMemo(() => {
        const month = new Date().getMonth() + 1 // 1-12
        return Math.min(Math.max(month, 1), 4) - 1 // 0-3 index for JAN-APR
    }, [])

    const currentMonthConfig = MONTHS_CONFIG[currentMonthIndex]

    // --- Data Calculation Logic ---
    const stats = useMemo(() => {
        // 1. Filter Products (New/Launched Only - but for now we might take all active ones for simplicity unless there's a specific flag?)
        // The user said "New Products" or "Launched". Let's look for "Launched" status or a "New" flag.
        // For MVP, we'll assume productsData contains the relevant SKUs or filter by status 'Launched'.
        const launchedSkus = new Set(
            productsData
                .filter((p: any) => p.status === "Launched") // Strict filter as requested
                .map((p: any) => p.sku_code?.toLowerCase().trim())
        )

        // Map Valid SKUs to their Cost (COGS)
        const skuCosts: Record<string, number> = {}
        productsData.forEach((p: any) => {
            const sku = p.sku_code?.toLowerCase().trim()
            if (sku) {
                // Remove commas and parse
                const costStr = String(p.cost || "0").replace(/,/g, "")
                skuCosts[sku] = parseFloat(costStr) || 0
            }
        })

        // 2. Filter Sales (JAN 1 - APR 30, 2026)
        const start = new Date("2026-01-01T00:00:00")
        const end = new Date("2026-04-30T23:59:59")

        let totalGP = 0
        let totalRevenue = 0
        let totalUnits = 0

        // Per-month GP tracking (index 0=JAN, 1=FEB, 2=MAR, 3=APR)
        const monthlyGP = [0, 0, 0, 0]
        const monthlyUnits = [0, 0, 0, 0]
        const monthlyRevenue = [0, 0, 0, 0]

        let currentMonthGP = 0
        let currentMonthUnits = 0

        // Per-SKU aggregation
        const skuStats: Record<string, {
            sku: string
            productName: string
            category: string
            launchMonth: string
            salesChannel: string
            costPerUnit: number
            gp: number
            revenue: number
            units: number
            gpPct: number
        }> = {}

        // Build SKU → product name/category/channel lookup from productsData
        const skuMeta: Record<string, { productName: string; category: string; launchMonth: string; salesChannel: string }> = {}
        productsData.forEach((p: any) => {
            const k = p.sku_code?.toLowerCase().trim()
            if (k) skuMeta[k] = {
                productName: p.product_name || p.sku_code || k,
                category: p.category || "—",
                launchMonth: p.launch_month || "—",
                salesChannel: p.sales_channel || "—",
            }
        })

        salesData.forEach(sale => {
            const saleDate = new Date(sale.Date)
            if (isNaN(saleDate.getTime())) return

            // Global Filter (JAN-APR 2026)
            if (saleDate >= start && saleDate <= end) {
                const sku = String(sale.SKU || "").toLowerCase().trim()
                if (!launchedSkus.has(sku)) return

                const units = parseFloat(String(sale["Units Sold"] || "0").replace(/,/g, "")) || 0
                const revenue = parseFloat(String(sale["Revenue"] || "0").replace(/,/g, "")) || 0

                // GP Formula: Net Rev / 1.07 * 0.77 - COGS * Units
                const netRevenue = revenue / 1.07
                const afterFees = netRevenue * 0.77
                const cogs = (skuCosts[sku] || 0) * units
                const gp = afterFees - cogs

                totalGP += gp
                totalRevenue += revenue
                totalUnits += units

                // Per-SKU accumulation
                if (!skuStats[sku]) {
                    const meta = skuMeta[sku] || { productName: sku, category: "—", launchMonth: "—", salesChannel: "—" }
                    skuStats[sku] = {
                        sku,
                        productName: meta.productName,
                        category: meta.category,
                        launchMonth: meta.launchMonth,
                        salesChannel: meta.salesChannel,
                        costPerUnit: skuCosts[sku] || 0,
                        gp: 0, revenue: 0, units: 0, gpPct: 0,
                    }
                }
                skuStats[sku].gp += gp
                skuStats[sku].revenue += revenue
                skuStats[sku].units += units

                // Map sale month to MONTHS_CONFIG index (JAN=0, FEB=1, MAR=2, APR=3)
                const configIndex = saleDate.getMonth()
                if (configIndex >= 0 && configIndex <= 3) {
                    monthlyGP[configIndex] += gp
                    monthlyUnits[configIndex] += units
                    monthlyRevenue[configIndex] += revenue
                }

                const configMonth = currentMonthConfig.id - 1
                if (saleDate.getMonth() === configMonth && saleDate.getFullYear() === 2026) {
                    currentMonthGP += gp
                    currentMonthUnits += units
                }
            }
        })

        // Calculate GP % per SKU
        Object.values(skuStats).forEach(s => {
            s.gpPct = s.revenue > 0 ? (s.gp / (s.revenue / 1.07)) * 100 : 0
        })

        // Sort by GP descending
        const skuBreakdown = Object.values(skuStats).sort((a, b) => b.gp - a.gp)

        return {
            totalGP,
            totalRevenue,
            totalUnits,
            currentMonthGP,
            currentMonthUnits,
            monthlyGP,
            monthlyUnits,
            monthlyRevenue,
            skuBreakdown,
        }
    }, [salesData, productsData, currentMonthConfig])

    // --- Helpers ---
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val)
    }

    // --- Section 1: Summary Cards ---
    const renderSummaryCards = () => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* SAFE GP */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">SAFE GP Target</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {viewMode === "daily"
                                ? formatCurrency(TARGETS.SAFE_GP_PER_DAY)
                                : formatCurrency(TARGETS.SAFE_GP_YEAR)
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {viewMode === "daily" ? "/ day" : "Annual Target"}
                        </p>
                        {viewMode === "daily" && (
                            <div className="space-y-1 mt-2">
                                <div className="flex justify-between text-[10px]">
                                    <span>Actual: {formatCurrency(stats.currentMonthGP / currentMonthConfig.days)}/d</span>
                                    <span>{Math.round(((stats.currentMonthGP / currentMonthConfig.days) / TARGETS.SAFE_GP_PER_DAY) * 100)}%</span>
                                </div>
                                <Progress value={((stats.currentMonthGP / currentMonthConfig.days) / TARGETS.SAFE_GP_PER_DAY) * 100} className="h-2" />
                            </div>
                        )}
                        {viewMode === "annual" && (
                            <div className="space-y-1 mt-2">
                                <div className="flex justify-between text-[10px]">
                                    <span>Actual: {formatCurrency(stats.totalGP)}</span>
                                    <span>{Math.round((stats.totalGP / TARGETS.SAFE_GP_YEAR) * 100)}%</span>
                                </div>
                                <Progress value={(stats.totalGP / TARGETS.SAFE_GP_YEAR) * 100} className="h-2" />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* STRETCH GP */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">STRETCH GP Target</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {viewMode === "daily"
                                ? formatCurrency(TARGETS.STRETCH_GP_PER_DAY)
                                : formatCurrency(TARGETS.STRETCH_GP_YEAR)
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {viewMode === "daily"
                                ? `vs Modeled: ${formatCurrency(stats.currentMonthGP / currentMonthConfig.days)}/d`
                                : "Annual Target (+15%)"}
                        </p>
                        {viewMode === "daily" && (
                            <div className="space-y-1 mt-2">
                                <Progress value={((stats.currentMonthGP / currentMonthConfig.days) / TARGETS.STRETCH_GP_PER_DAY) * 100} className="h-2" />
                                <div className="flex justify-end text-[10px] mt-1">
                                    <span>{Math.round(((stats.currentMonthGP / currentMonthConfig.days) / TARGETS.STRETCH_GP_PER_DAY) * 100)}%</span>
                                </div>
                            </div>
                        )}
                        {viewMode === "annual" && (
                            <div className="space-y-1 mt-2">
                                <div className="flex justify-between text-[10px]">
                                    <span>Actual: {formatCurrency(stats.totalGP)}</span>
                                    <span>{Math.round((stats.totalGP / TARGETS.STRETCH_GP_YEAR) * 100)}%</span>
                                </div>
                                <Progress value={(stats.totalGP / TARGETS.STRETCH_GP_YEAR) * 100} className="h-2" />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Units Target */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Units Target</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {viewMode === "daily"
                                ? `${Math.round(currentMonthConfig.units / currentMonthConfig.days)}`
                                : `${TARGETS.MODELED_UNITS_YEAR}`
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {viewMode === "daily"
                                ? `Avg Actual: ${Math.round(stats.currentMonthUnits / currentMonthConfig.days)}/d`
                                : `Actual: ${stats.totalUnits} Units`
                            }
                        </p>
                        {viewMode === "daily" && (
                            <div className="space-y-1 mt-2">
                                <Progress value={((stats.currentMonthUnits / currentMonthConfig.days) / (currentMonthConfig.units / currentMonthConfig.days)) * 100} className="h-2" />
                                <div className="flex justify-end text-[10px] mt-1">
                                    <span>{Math.round(((stats.currentMonthUnits / currentMonthConfig.days) / (currentMonthConfig.units / currentMonthConfig.days)) * 100)}%</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Investment / SKUs */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {viewMode === "daily" ? "Avg Investment" : "Total SKUs"}
                        </CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {viewMode === "daily"
                                ? formatCurrency(currentMonthConfig.budget / currentMonthConfig.days)
                                : `${TARGETS.TOTAL_SKUS}`
                            }
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {viewMode === "daily" ? "per day" : "New SKUs Plan"}
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // --- Section 1B: Breakdown Tabs ---
    const renderDailyTab = () => (
        <div className="space-y-6">
            {/* Benchmark Grid */}
            <div className="grid grid-cols-4 gap-4 text-center">
                {MONTHS_CONFIG.map((m, idx) => (
                    <div key={m.id} className={cn(
                        "p-4 rounded-lg border",
                        idx === currentMonthIndex ? "bg-primary/5 border-primary" : "bg-card"
                    )}>
                        <h4 className="font-semibold text-sm mb-2">{m.name}</h4>
                        <div className="text-xs space-y-1">
                            <div>Units: {Math.round(m.units / m.days)}/d</div>
                            <div>GP: {formatCurrency(m.gp / m.days)}/d</div>
                        </div>
                    </div>
                ))}
            </div>

        </div>
    )

    const renderWeeklyTab = () => (
        <Card>
            <CardHeader>
                <CardTitle>Weekly Rhythm</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Week</TableHead>
                            <TableHead>Focus</TableHead>
                            <TableHead>Key Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">W1</TableCell>
                            <TableCell>Launch Execution</TableCell>
                            <TableCell>Get all SKUs live (Capture 30% T-ramp)</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">W1-W2</TableCell>
                            <TableCell>Monitoring</TableCell>
                            <TableCell>Early sales signal monitoring per SKU</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">W2</TableCell>
                            <TableCell>GP & Pipeline</TableCell>
                            <TableCell>Mid-month GP% review vs 47.3% baseline. Prep next month pipeline.</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">W3</TableCell>
                            <TableCell>Investment</TableCell>
                            <TableCell>Review burn rate against monthly budget.</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">W4</TableCell>
                            <TableCell>Forecast & T+1</TableCell>
                            <TableCell>Verify T+1 carry-over ramp (70%). Gap analysis.</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>

                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-md flex gap-2 text-sm text-red-800">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p>Alert: If actual ramp deviates from 30%/70% model by &gt;20%, update model immediately.</p>
                </div>
            </CardContent>
        </Card>
    )

    const renderMonthlyTab = () => (
        <Card>
            <CardContent className="pt-6">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">GP Target</TableHead>
                            <TableHead className="text-right">Units</TableHead>
                            <TableHead className="text-right">Budget</TableHead>
                            <TableHead className="text-right">SKUs</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {MONTHS_CONFIG.map(m => (
                            <TableRow key={m.id}>
                                <TableCell className="font-medium">{m.name}</TableCell>
                                <TableCell>
                                    <Badge variant={m.id === currentMonthIndex + 1 ? "default" : "secondary"}>
                                        {m.label}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(m.gp)}</TableCell>
                                <TableCell className="text-right">{m.units}</TableCell>
                                <TableCell className="text-right">{formatCurrency(m.budget)}</TableCell>
                                <TableCell className="text-right">{m.skus}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )

    // --- Section 2: Launch Roadmap ---
    const renderLaunchRoadmap = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MONTHS_CONFIG.map((m, idx) => {
                const isCurrent = idx === currentMonthIndex
                return (
                    <Card key={m.id} className={cn("relative overflow-hidden", isCurrent && "border-yellow-400 ring-4 ring-yellow-400/20")}>
                        {isCurrent && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">CURRENT</div>}
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{m.name}</CardTitle>
                            <CardDescription>{m.skus} Products</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Invest</span>
                                <span className="font-medium">{formatCurrency(m.budget)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">GP Model</span>
                                <span className="font-medium">{formatCurrency(m.gp)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Units</span>
                                <span className="font-medium">{m.units}</span>
                            </div>
                            <div className="pt-2 border-t text-xs text-muted-foreground">
                                Ramp: 30% T / 70% T+1
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )

    // --- Section 3: Key Variables ---
    const renderKeyVariables = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
                { title: "On-Time Launch", desc: "Every week delay costs ~25% of T-ramp GP." },
                { title: "Ramp Rate (30/70)", desc: "Backbone of model. Deviations must be caught early." },
                { title: "Investment Efficiency", desc: "฿3.37M invest must return ฿2.03M+ GP." },
                { title: "Units vs Model", desc: "Tracking 1,310 units total (JAN-APR)." },
                { title: "GP per SKU", desc: "Any SKU falling below model needs action." },
                { title: "Category Mix", desc: "Contribution to SAFE +10% / STRETCH +15%." },
            ].map((item, i) => (
                <Card key={i} className="bg-muted/30">
                    <CardHeader className="p-4">
                        <CardTitle className="text-sm">{item.title}</CardTitle>
                        <CardDescription className="text-xs mt-1">{item.desc}</CardDescription>
                    </CardHeader>
                </Card>
            ))}
        </div>
    )

    // --- Section 4: GP Breakdown ---
    const renderGPBreakdown = () => {
        const totalModelGP = MONTHS_CONFIG.reduce((s, m) => s + m.gp, 0)
        const totalActualGP = stats.totalGP
        const overallPct = totalModelGP > 0 ? Math.round((totalActualGP / totalModelGP) * 100) : 0

        const getHealthLevel = (pct: number) => {
            if (pct >= 80) return { label: "HIGH", color: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" }
            if (pct >= 40) return { label: "ON TRACK", color: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" }
            return { label: "LOW", color: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" }
        }

        return (
            <div className="space-y-6">
                {/* Overall GP Health Banner */}
                <div className={cn(
                    "rounded-xl border-2 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
                    getHealthLevel(overallPct).bg,
                    getHealthLevel(overallPct).border
                )}>
                    <div className="flex items-center gap-3">
                        <Activity className={cn("h-6 w-6", getHealthLevel(overallPct).text)} />
                        <div>
                            <p className="font-semibold text-sm">Overall GP Achievement (JAN–APR 2026)</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Actual {formatCurrency(totalActualGP)} vs Model {formatCurrency(totalModelGP)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={cn("text-3xl font-bold", getHealthLevel(overallPct).text)}>{overallPct}%</div>
                        <Badge className={cn("text-xs", getHealthLevel(overallPct).text, getHealthLevel(overallPct).bg, getHealthLevel(overallPct).border, "border")}>
                            {getHealthLevel(overallPct).label}
                        </Badge>
                    </div>
                </div>

                {/* Month-by-Month GP Breakdown Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {MONTHS_CONFIG.map((m, idx) => {
                        const actualGP = stats.monthlyGP[idx] ?? 0
                        const pct = m.gp > 0 ? Math.round((actualGP / m.gp) * 100) : 0
                        const health = getHealthLevel(pct)
                        const efficiency = m.budget > 0 ? ((actualGP / m.budget) * 100).toFixed(1) : "0.0"
                        const modelEfficiency = m.budget > 0 ? ((m.gp / m.budget) * 100).toFixed(1) : "0.0"
                        const gpPerSku = m.skus > 0 ? m.gp / m.skus : 0
                        const actualGpPerSku = m.skus > 0 ? actualGP / m.skus : 0
                        const isCurrent = idx === currentMonthIndex
                        return (
                            <Card key={m.id} className={cn(
                                "border-2 transition-all",
                                isCurrent ? "border-yellow-400 ring-2 ring-yellow-400/20" : health.border
                            )}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-bold">{m.name}</CardTitle>
                                        <Badge variant="outline" className={cn("text-[10px] font-semibold", health.text, health.bg, health.border, "border")}>
                                            {health.label}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-[11px]">{m.skus} SKUs · {m.units} units planned</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {/* GP Progress */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">GP vs Model</span>
                                            <span className={cn("font-semibold", health.text)}>{pct}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all", health.color)}
                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>Actual: {formatCurrency(actualGP)}</span>
                                            <span>Model: {formatCurrency(m.gp)}</span>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t pt-2 space-y-1.5">
                                        {/* GP/Invest Efficiency */}
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">GP / Invest Efficiency</span>
                                            <div className="flex items-center gap-1">
                                                {parseFloat(efficiency) >= parseFloat(modelEfficiency)
                                                    ? <TrendingUp className="h-3 w-3 text-emerald-600" />
                                                    : <TrendingDown className="h-3 w-3 text-red-500" />
                                                }
                                                <span className={cn("font-semibold", parseFloat(efficiency) >= parseFloat(modelEfficiency) ? "text-emerald-600" : "text-red-500")}>
                                                    {efficiency}%
                                                </span>
                                                <span className="text-muted-foreground">/ {modelEfficiency}% model</span>
                                            </div>
                                        </div>

                                        {/* GP per SKU */}
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">GP / SKU</span>
                                            <div className="text-right">
                                                <span className="font-semibold">{formatCurrency(actualGpPerSku)}</span>
                                                <span className="text-muted-foreground ml-1">actual</span>
                                                <span className="text-muted-foreground"> / {formatCurrency(gpPerSku)} model</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>

                {/* Summary Table */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">GP Breakdown Summary</CardTitle>
                        <CardDescription className="text-xs">Actual vs Model — Investment Efficiency per Month</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right">GP Model</TableHead>
                                    <TableHead className="text-right">Actual GP</TableHead>
                                    <TableHead className="text-right">Achievement</TableHead>
                                    <TableHead className="text-right">GP/Invest</TableHead>
                                    <TableHead className="text-right">GP/SKU</TableHead>
                                    <TableHead className="text-center">Health</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {MONTHS_CONFIG.map((m, idx) => {
                                    const actualGP = stats.monthlyGP[idx] ?? 0
                                    const pct = m.gp > 0 ? Math.round((actualGP / m.gp) * 100) : 0
                                    const health = getHealthLevel(pct)
                                    const efficiency = m.budget > 0 ? ((actualGP / m.budget) * 100).toFixed(1) : "0.0"
                                    const modelEfficiency = m.budget > 0 ? ((m.gp / m.budget) * 100).toFixed(1) : "0.0"
                                    const actualGpPerSku = m.skus > 0 ? actualGP / m.skus : 0
                                    const modelGpPerSku = m.skus > 0 ? m.gp / m.skus : 0
                                    return (
                                        <TableRow key={m.id} className={idx === currentMonthIndex ? "bg-yellow-50" : ""}>
                                            <TableCell className="font-semibold">
                                                {m.name}
                                                {idx === currentMonthIndex && <Badge variant="outline" className="ml-2 text-[9px] py-0 h-4 bg-yellow-100 text-yellow-800 border-yellow-300">NOW</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">{formatCurrency(m.gp)}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(actualGP)}</TableCell>
                                            <TableCell className="text-right">
                                                <span className={cn("font-bold", health.text)}>{pct}%</span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {parseFloat(efficiency) >= parseFloat(modelEfficiency)
                                                        ? <TrendingUp className="h-3 w-3 text-emerald-600" />
                                                        : <TrendingDown className="h-3 w-3 text-red-500" />
                                                    }
                                                    <span className={cn("text-xs font-medium", parseFloat(efficiency) >= parseFloat(modelEfficiency) ? "text-emerald-600" : "text-red-500")}>
                                                        {efficiency}%
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">/{modelEfficiency}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-xs">
                                                <span className="font-medium">{formatCurrency(actualGpPerSku)}</span>
                                                <span className="text-muted-foreground"> / {formatCurrency(modelGpPerSku)}</span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className={cn("text-[10px]", health.text, health.bg, health.border, "border")}>{health.label}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {/* Total Row */}
                                <TableRow className="border-t-2 font-semibold bg-muted/30">
                                    <TableCell>Total</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{formatCurrency(totalModelGP)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalActualGP)}</TableCell>
                                    <TableCell className="text-right">
                                        <span className={cn("font-bold", getHealthLevel(overallPct).text)}>{overallPct}%</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="text-xs font-medium">
                                            {totalModelGP > 0 ? ((totalActualGP / MONTHS_CONFIG.reduce((s, m) => s + m.budget, 0)) * 100).toFixed(1) : "0.0"}%
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right text-xs">
                                        <span className="text-muted-foreground">—</span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge className={cn("text-[10px]", getHealthLevel(overallPct).text, getHealthLevel(overallPct).bg, getHealthLevel(overallPct).border, "border")}>
                                            {getHealthLevel(overallPct).label}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Per-Product Breakdown Table */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Per-Product GP Breakdown
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Each launched SKU — Actual GP, Revenue &amp; Margin (JAN–APR 2026), sorted High → Low
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.skuBreakdown.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                No launched SKUs with sales data found for JAN–APR 2026.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[36px]">#</TableHead>
                                        <TableHead>Product Name</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Launch</TableHead>
                                        <TableHead>Channel</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">Units</TableHead>
                                        <TableHead className="text-right">Actual GP</TableHead>
                                        <TableHead className="text-right">GP Margin</TableHead>
                                        <TableHead className="text-center">Health</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.skuBreakdown.map((s, idx) => {
                                        const marginPct = s.gpPct
                                        const health = marginPct >= 50
                                            ? { label: "HIGH", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", barColor: "bg-emerald-500" }
                                            : marginPct >= 30
                                                ? { label: "ON TRACK", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", barColor: "bg-amber-400" }
                                                : { label: "LOW", text: "text-red-700", bg: "bg-red-50", border: "border-red-200", barColor: "bg-red-500" }
                                        const gpBar = Math.min(Math.max(marginPct, 0), 100)
                                        return (
                                            <TableRow key={s.sku} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                                                <TableCell className="text-muted-foreground text-xs font-mono">{idx + 1}</TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="max-w-[160px] truncate" title={s.productName}>{s.productName}</div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs uppercase text-muted-foreground">{s.sku}</TableCell>
                                                <TableCell className="text-xs">{s.category}</TableCell>
                                                <TableCell className="text-xs">{s.launchMonth}</TableCell>
                                                <TableCell className="text-xs">{s.salesChannel}</TableCell>
                                                <TableCell className="text-right text-xs">{formatCurrency(s.revenue)}</TableCell>
                                                <TableCell className="text-right text-xs">{s.units.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-semibold">{formatCurrency(s.gp)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                                            <div className={cn("h-full rounded-full", health.barColor)} style={{ width: `${gpBar}%` }} />
                                                        </div>
                                                        <span className={cn("text-xs font-semibold", health.text)}>
                                                            {marginPct.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={cn("text-[10px]", health.text, health.bg, health.border, "border")}>
                                                        {health.label}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Launch 2026 Command Center</h1>
                    <p className="text-muted-foreground">Strategic tracking for JAN-APR 2026 Product Launches</p>
                </div>
                <div className="flex items-center bg-muted p-1 rounded-lg">
                    <Button
                        variant={viewMode === "daily" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("daily")}
                        className="text-xs"
                    >
                        <Sun className="mr-2 h-3.5 w-3.5" /> Daily
                    </Button>
                    <Button
                        variant={viewMode === "annual" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("annual")}
                        className="text-xs"
                    >
                        <TrendingUp className="mr-2 h-3.5 w-3.5" /> Annual
                    </Button>
                </div>
            </div>

            {/* Section 1: Annual Goals */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" /> 1. Annual Goals (2026)
                </h2>

                {renderSummaryCards()}

                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                    <TabsList className="grid w-full md:w-[400px] grid-cols-3">
                        <TabsTrigger value="daily">Daily</TabsTrigger>
                        <TabsTrigger value="weekly">Weekly</TabsTrigger>
                        <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    </TabsList>
                    <div className="mt-4">
                        <TabsContent value="daily" className="mt-0">{renderDailyTab()}</TabsContent>
                        <TabsContent value="weekly" className="mt-0">{renderWeeklyTab()}</TabsContent>
                        <TabsContent value="monthly" className="mt-0">{renderMonthlyTab()}</TabsContent>
                    </div>
                </Tabs>
            </section>

            {/* Section 2: Roadmap */}
            <section className="space-y-4 pt-6 border-t">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5" /> 2. Monthly Launch Roadmap
                </h2>
                {renderLaunchRoadmap()}
            </section>

            {/* Section 4: GP Breakdown */}
            <section className="space-y-4 pt-6 border-t">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Activity className="h-5 w-5" /> 4. GP Breakdown Analysis
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Month-by-month GP health — High / On Track / Low vs model targets
                    </p>
                </div>
                {renderGPBreakdown()}
            </section>
        </div>
    )
}
