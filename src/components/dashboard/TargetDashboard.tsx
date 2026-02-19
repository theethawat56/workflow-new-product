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
import { Sun, Calendar, BarChart3, TrendingUp, DollarSign, Package, AlertCircle } from "lucide-react"

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

        // Daily aggregation for the current month
        let currentMonthGP = 0
        let currentMonthUnits = 0
        const now = new Date()
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        salesData.forEach(sale => {
            const saleDate = new Date(sale.Date) // format: "2026-01-01" or as provided by Sale_All
            if (isNaN(saleDate.getTime())) return

            // Global Filter (JAN-APR)
            if (saleDate >= start && saleDate <= end) {
                const sku = String(sale.SKU || "").toLowerCase().trim()

                // Only count if it's a "New/Launched" SKU
                // User said: "focus on sku have status launched"
                if (!launchedSkus.has(sku)) return

                const units = parseFloat(String(sale["Units Sold"] || "0").replace(/,/g, "")) || 0
                const revenue = parseFloat(String(sale["Revenue"] || "0").replace(/,/g, "")) || 0

                // --- GP Formula ---
                // Net Revenue = Revenue / 1.07
                // After Fees = Net Revenue * 0.77
                // GP = After Fees - (COGS * Units)
                const netRevenue = revenue / 1.07
                const afterFees = netRevenue * 0.77
                const cogs = (skuCosts[sku] || 0) * units
                const gp = afterFees - cogs

                totalGP += gp
                totalRevenue += revenue
                totalUnits += units

                // Current Month Stats
                // Note: currentMonthIndex is 0-3 (JAN-APR). We should match the configured month.
                // If dashboard is in "JAN", we count JAN sales.
                const configMonth = currentMonthConfig.id - 1 // 0-based
                if (saleDate.getMonth() === configMonth && saleDate.getFullYear() === 2026) {
                    currentMonthGP += gp
                    currentMonthUnits += units
                }
            }
        })

        return {
            totalGP,
            totalRevenue,
            totalUnits,
            currentMonthGP,
            currentMonthUnits
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

            {/* Morning Questions */}
            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Sun className="h-4 w-4 text-orange-500" />
                        Morning Check-in
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Any SKU needs to be launched or followed up today?</li>
                        <li>How did yesterday's units compare to the daily model?</li>
                        <li>Is there any gap to action before the end of the week?</li>
                    </ul>
                </CardContent>
            </Card>

            {/* Daily Checklist (LocalStorage logic to be added) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Daily Protocol</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {["Check Sales Dashboard", "Review Ad Spend", "Check Inventory Levels", "Review Customer/KOL Feedback", "Update Team Task Status"].map((item, i) => (
                            <div key={i} className="flex items-center space-x-2">
                                <Checkbox id={`task-${i}`} />
                                <label
                                    htmlFor={`task-${i}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {item} (Placeholder)
                                </label>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
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

            {/* Section 3: Variables */}
            <section className="space-y-4 pt-6 border-t">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" /> 3. Key Variables
                </h2>
                {renderKeyVariables()}
            </section>
        </div>
    )
}
