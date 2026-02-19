"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Line
} from "recharts"
import { Rocket, DollarSign, AlertTriangle, CheckCircle, Package } from "lucide-react"

// --- Interfaces ---

interface Product {
    sku_code: string
    product_name: string
    category: string
    go_live_date: string
    cost: number | string
    price: number | string
    gp_pct: number | string
    status: string
}

interface LaunchedProduct {
    zort_sku: string
    launch_date: string
    launch_type?: string
}

interface SaleOrderItem {
    sku: string
    total_amount: number | string
    quantity: number | string
    status: string
    payment_status: string
    order_date: string
}

interface TargetPlan {
    sku: string
    launch_month_plan: string
    expected_units_m1: number | string
    expected_units_m2: number | string
    expected_gp_m1: number | string
    invest_total: number | string
    price_plan: number | string
    gp_per_unit_plan: number | string
}

// --- Component ---

export function LaunchControlTower({
    products,
    launchedProducts,
    sales,
    plans
}: {
    products: Product[],
    launchedProducts: LaunchedProduct[],
    sales: SaleOrderItem[],
    plans: TargetPlan[]
}) {

    // --- Data Processing (The "Data Mart") ---

    const dashboardData = useMemo(() => {
        // 1. Create Maps for O(1) lookup
        const productMap = new Map(products.map(p => [p.sku_code, p]))
        const launchMap = new Map(launchedProducts.map(l => [l.zort_sku, l]))
        const planMap = new Map(plans.map(p => [p.sku, p]))

        // 2. Aggregate Sales by SKU
        const salesBySku: Record<string, { revenue: number, units: number, gp: number }> = {}

        sales.forEach(item => {
            // Filter: Recognized Sales only
            if (item.status === "Success" && item.payment_status === "Paid") {
                const sku = item.sku
                if (!salesBySku[sku]) salesBySku[sku] = { revenue: 0, units: 0, gp: 0 }

                const qty = Number(item.quantity) || 0
                const amount = Number(item.total_amount) || 0

                salesBySku[sku].revenue += amount
                salesBySku[sku].units += qty

                // Hybrid GP Logic
                const product = productMap.get(sku)
                const plan = planMap.get(sku)

                let gp = 0
                const cost = Number(product?.cost)
                const price = Number(product?.price)
                const gp_pct = Number(product?.gp_pct)
                const plan_gp_unit = Number(plan?.gp_per_unit_plan)

                if (!isNaN(cost) && !isNaN(price) && cost > 0) {
                    gp = (price - cost) * qty // Tier 1: Cost-based
                } else if (!isNaN(gp_pct) && gp_pct > 0) {
                    gp = amount * gp_pct // Tier 2: GP% based
                } else if (!isNaN(plan_gp_unit) && plan_gp_unit > 0) {
                    gp = qty * plan_gp_unit // Tier 3: Plan fallback
                } else {
                    gp = 0 // Unknown
                }
                salesBySku[sku].gp += gp
            }
        })

        // 3. Build "dim_product" enriched list
        const enrichedProducts = products.map(p => {
            const launchInfo = launchMap.get(p.sku_code)
            const plan = planMap.get(p.sku_code)
            const actuals = salesBySku[p.sku_code] || { revenue: 0, units: 0, gp: 0 }

            const launchDate = launchInfo?.launch_date || p.go_live_date
            const isNew = launchInfo?.launch_type === 'NEW_LAUNCH' || (new Date(launchDate).getFullYear() === new Date().getFullYear())

            return {
                ...p,
                isNew,
                launchDate,
                actualRevenue: actuals.revenue,
                actualUnits: actuals.units,
                actualGP: actuals.gp,
                planRevenue: 0, // Placeholder
                planUnitsM1: Number(plan?.expected_units_m1) || 0,
                planGPM1: Number(plan?.expected_gp_m1) || 0,
                hasPlan: !!plan,
                isLaunched: !!launchInfo
            }
        })

        // 4. Calculate KPIs (Focus on New Products)
        const newProducts = enrichedProducts.filter(p => p.isNew)

        const totalRevenue = newProducts.reduce((sum, p) => sum + p.actualRevenue, 0)
        const totalUnits = newProducts.reduce((sum, p) => sum + p.actualUnits, 0)
        const totalGP = newProducts.reduce((sum, p) => sum + p.actualGP, 0)
        const launchCount = newProducts.filter(p => p.isLaunched).length
        const plannedLaunchCount = plans.length // Proxy for now

        // 5. "Push Next" Rules Engine & Chart Data
        let totalPlanRevenue = 0

        const pushNextList = newProducts.map(p => {
            const tags: string[] = []
            let action = ""
            let priority = 0

            // Plan Calculation
            const plan = planMap.get(p.sku_code)
            let planRevenue = 0

            if (plan) {
                // Determine current month index relative to launch (0 = M1, 1 = M2)
                const launchDateStr = p.launchDate || "2026-01-01"
                const launchDate = new Date(launchDateStr)
                const now = new Date()
                const monthDiff = (now.getFullYear() - launchDate.getFullYear()) * 12 + (now.getMonth() - launchDate.getMonth())

                const price = Number(plan.price_plan) || Number(p.price) || 0

                // Accumulate Plan Revenue based on "Month on Market"
                // Simplified: usage plan for M1 and M2
                if (monthDiff === 0) planRevenue = (Number(plan.expected_units_m1) || 0) * price
                else if (monthDiff >= 1) planRevenue = ((Number(plan.expected_units_m1) || 0) + (Number(plan.expected_units_m2) || 0)) * price // Cumulative? No, sticking to month targets might be better but for "Total" let's use MTM or YTD. 
                // Let's assume Plan is "Total expected to date" for simplicity in this MVP view

                // Logic Adjustment: If we just seeded M1/M2, let's treat "planRevenue" as the target for the current period.
                if (monthDiff <= 0) planRevenue = (Number(plan.expected_units_m1) || 0) * price
                else planRevenue = (Number(plan.expected_units_m2) || 0) * price

                // If planRevenue is 0 (e.g. data missing), fallback
                if (planRevenue === 0 && price > 0) {
                    planRevenue = 100000 // Dummy fallback to show gap if plan exists but units missing
                }
            }

            totalPlanRevenue += planRevenue
            const gap = p.actualRevenue - planRevenue

            // Rule 1: Not Launched but Planned
            if (p.hasPlan && !p.isLaunched) {
                tags.push("NOT_LAUNCHED")
                action = "Check launch blockage"
                priority = 10
            }
            // Rule 2: Underperforming
            else if (p.isLaunched && p.actualRevenue < 1000) {
                tags.push("UNDERPERFORMING")
                action = "Boost visibility / Ads"
                priority = 8
            }
            // Rule 3: Missing Data
            else if (!p.cost && !p.gp_pct && !p.hasPlan) {
                tags.push("DATA_MISSING")
                action = "Add Cost/GP data"
                priority = 5
            }

            return {
                ...p,
                tags,
                action,
                priority,
                planRevenue,
                gap
            }
        })
            .filter(p => p.tags.length > 0 || p.hasPlan)
            .sort((a, b) => b.priority - a.priority)

        // Prepare Chart Data: Top 5 Revenue vs Plan
        const chartData = pushNextList
            .slice(0, 5)
            .map(p => ({
                name: p.product_name,
                Actual: p.actualRevenue,
                Plan: p.planRevenue
            }))

        const gapPercentage = totalPlanRevenue > 0 ? ((totalRevenue - totalPlanRevenue) / totalPlanRevenue) * 100 : 0

        return {
            totalRevenue,
            totalUnits,
            totalGP,
            launchCount,
            plannedLaunchCount,
            pushNextList: pushNextList.slice(0, 10),
            chartData,
            gapPercentage,
            totalPlanRevenue
        }

    }, [products, launchedProducts, sales, plans])


    return (
        <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New Product Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">฿{dashboardData.totalRevenue.toLocaleString()}</div>
                        <p className={`text-xs ${dashboardData.gapPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {dashboardData.gapPercentage >= 0 ? '+' : ''}{dashboardData.gapPercentage.toFixed(1)}% vs Plan
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New Product GP (Est)</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">฿{dashboardData.totalGP.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Hybrid Calculation</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Launch Count</CardTitle>
                        <Rocket className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboardData.launchCount} / {dashboardData.plannedLaunchCount}</div>
                        <p className="text-xs text-muted-foreground">Actual vs Plan</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Action Items</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dashboardData.pushNextList.length}</div>
                        <p className="text-xs text-muted-foreground">SKUs need attention</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="actions" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="actions">Where to Push Next</TabsTrigger>
                    <TabsTrigger value="charts">Performance Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="actions" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Where to Push Next (Top 10)</CardTitle>
                            <CardDescription>
                                SKUs identified by the rules engine as requiring immediate attention.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full caption-bottom text-sm text-left">
                                    <thead className="[&_tr]:border-b">
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Product</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Reason</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Recommended Action</th>
                                            <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Revenue Gap</th>
                                        </tr>
                                    </thead>
                                    <tbody className="[&_tr:last-child]:border-0">
                                        {dashboardData.pushNextList.map(item => (
                                            <tr key={item.sku_code} className="border-b transition-colors hover:bg-muted/50">
                                                <td className="p-4 align-middle font-medium">
                                                    {item.product_name}
                                                    <div className="text-xs text-muted-foreground">{item.sku_code}</div>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.isLaunched ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {item.isLaunched ? 'Launched' : 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    {item.tags.map(tag => (
                                                        <span key={tag} className="mr-1 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold text-foreground">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td className="p-4 align-middle text-blue-600 font-medium">
                                                    {item.action}
                                                </td>
                                                <td className={`p-4 align-middle text-right font-bold ${item.gap >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {item.gap > 0 ? '+' : ''}{Math.round(item.gap).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {dashboardData.pushNextList.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                                                    No urgent items found. Great job!
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="charts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Top Products: Actual vs Plan</CardTitle>
                            <CardDescription>Revenue comparison for key new products.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dashboardData.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip formatter={(value) => `฿${Number(value).toLocaleString()}`} />
                                    <Legend />
                                    <Bar dataKey="Actual" fill="#22c55e" name="Actual Revenue" />
                                    <Bar dataKey="Plan" fill="#94a3b8" name="Planned Revenue" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
