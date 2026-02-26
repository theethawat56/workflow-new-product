"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    ComposedChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from "recharts"
import { RefreshCw, ShoppingCart, DollarSign, Rocket, Filter, Calendar as CalendarIcon, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import {
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    subDays,
    subMonths,
    subYears,
    isWithinInterval,
    isValid
} from "date-fns"

interface SaleAllRow {
    Date: string
    SKU: string
    "Product Name": string
    "Units Sold": string | number
    Revenue: string | number
    "Avg Selling Price": string | number
}

interface LaunchedProduct {
    zort_sku: string
    launch_date: string
    product_name: string
    status: string
    launch_type?: string // NEW_LAUNCH | EXISTING_ADDITION
}

interface Product {
    product_id: string
    sku_code: string
    product_name: string
    category: string
    sub_category: string
    go_live_date: string
}

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function SalesDashboard({ initialData, launchedProducts, products }: { initialData: any[], launchedProducts: LaunchedProduct[], products: Product[] }) {
    const [syncing, setSyncing] = useState(false)
    const router = useRouter()

    // Filters
    const [statusFilter, setStatusFilter] = useState("ALL") // ALL | NEW | EXISTING
    const [categoryFilter, setCategoryFilter] = useState("ALL")
    const [subCategoryFilter, setSubCategoryFilter] = useState("ALL")
    const [periodFilter, setPeriodFilter] = useState("THIS_YEAR")
    const [searchQuery, setSearchQuery] = useState("")

    const currentYear = new Date().getFullYear()

    // 1. Process Data & Join
    const processedData = useMemo(() => {
        // Create Product Map for fast lookup
        const productMap = new Map<string, Product>()
        products.forEach(p => productMap.set(p.sku_code, p))

        // Create Map for Launched Products to access launch_type
        const launchedMap = new Map<string, LaunchedProduct>()
        launchedProducts.forEach(p => launchedMap.set(p.zort_sku, p))

        return (initialData as SaleAllRow[])
            .map((item, index) => {
                const sku = item.SKU
                const product = productMap.get(sku)
                const launchedInfo = launchedMap.get(sku)

                const launchDate = product?.go_live_date ? new Date(product.go_live_date) : null
                const launchYear = launchDate ? launchDate.getFullYear() : null

                // Determine if new: 
                // Priority 1: Explicit launch_type = 'NEW_LAUNCH'
                // Priority 2: In launched_products AND launch_type is undefined (legacy data) AND launchYear is current year
                // Priority 3: Not in launched_products but launchYear is current year (fallback)
                // BUT: valid existing products should have launch_type = 'EXISTING_ADDITION'

                let isNew = false
                if (launchedInfo) {
                    if (launchedInfo.launch_type === 'NEW_LAUNCH') {
                        isNew = true
                    } else if (launchedInfo.launch_type === 'EXISTING_ADDITION') {
                        isNew = false
                    } else {
                        // Legacy data (no launch_type yet), fallback to year check
                        isNew = (launchYear === currentYear)
                    }
                } else {
                    // Not in launched_products sheet at all, fallback to product table date
                    isNew = (launchYear === currentYear)
                }

                // Synthesize fields to match internal structure expected by charts
                return {
                    order_id: `ord-${index}-${sku}`, // Synthetic ID
                    order_number: `ORD-${index}`,
                    order_date: item.Date,
                    sales_channel: "Unknown",
                    sku: sku,
                    product_name: item["Product Name"],
                    quantity: Number(String(item["Units Sold"]).replace(/,/g, '')) || 0,
                    total_amount: Number(String(item.Revenue).replace(/,/g, '')) || 0,
                    status: "Completed",

                    // Computed fields
                    date: new Date(item.Date),
                    isNewProduct: isNew,
                    category: product?.category || "Uncategorized",
                    sub_category: product?.sub_category || "Uncategorized",
                    product_id: product?.product_id,
                    launch_type: launchedInfo?.launch_type
                }
            })
            .filter(item => isValid(item.date))
    }, [initialData, products, launchedProducts, currentYear])

    // 2. Filter Data
    const filteredData = useMemo(() => {
        const now = new Date()
        let interval: { start: Date, end: Date } | null = null

        switch (periodFilter) {
            case "TODAY":
                interval = { start: startOfDay(now), end: endOfDay(now) }
                break
            case "YESTERDAY":
                const yesterday = subDays(now, 1)
                interval = { start: startOfDay(yesterday), end: endOfDay(yesterday) }
                break
            case "THIS_WEEK":
                interval = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
                break
            case "LAST_WEEK":
                const lastWeek = subDays(now, 7)
                interval = { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) }
                break
            case "THIS_MONTH":
                interval = { start: startOfMonth(now), end: endOfMonth(now) }
                break
            case "LAST_MONTH":
                const lastMonth = subMonths(now, 1)
                interval = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
                break
            case "THIS_YEAR":
                interval = { start: startOfYear(now), end: endOfYear(now) }
                break
            case "LAST_YEAR":
                const lastYear = subYears(now, 1)
                interval = { start: startOfYear(lastYear), end: endOfYear(lastYear) }
                break
            case "LAST_30_DAYS":
                interval = { start: subDays(now, 30), end: now }
                break
            case "LAST_90_DAYS":
                interval = { start: subDays(now, 90), end: now }
                break
            case "ALL":
                interval = null
                break
        }

        return processedData.filter(item => {
            // Date Filter
            if (interval && !isWithinInterval(item.date, interval)) return false

            // Status Filter
            if (statusFilter === "NEW" && !item.isNewProduct) return false
            if (statusFilter === "EXISTING" && item.isNewProduct) return false

            // Category Filter
            if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false

            // Sub-Category Filter
            if (subCategoryFilter !== "ALL" && item.sub_category !== subCategoryFilter) return false

            return true
        })
    }, [processedData, statusFilter, categoryFilter, subCategoryFilter, periodFilter])

    // 3. Aggregate Metrics
    const totalRevenue = filteredData.reduce((sum, item) => sum + item.total_amount, 0)
    const newProductRevenue = filteredData
        .filter(item => item.isNewProduct)
        .reduce((sum, item) => sum + item.total_amount, 0)

    // Calculate share based on filtered view or global? 
    // Usually share is relevant to the current filtered set.
    const revenueShare = totalRevenue > 0 ? (newProductRevenue / totalRevenue) * 100 : 0
    const uniqueOrders = new Set(filteredData.map(i => i.order_id)).size

    // 4. Prepare Chart Data

    // Chart: Growth Trend (Composed used for Impact Analysis)
    const salesByDay: Record<string, { date: string, new: number, existing: number, total: number }> = {}
    filteredData.forEach(item => {
        const day = item.date.toISOString().split('T')[0]
        if (!salesByDay[day]) {
            salesByDay[day] = { date: day, new: 0, existing: 0, total: 0 }
        }
        salesByDay[day].total += item.total_amount
        if (item.isNewProduct) {
            salesByDay[day].new += item.total_amount
        } else {
            salesByDay[day].existing += item.total_amount
        }
    })
    const trendData = Object.values(salesByDay)
        .sort((a, b) => a.date.localeCompare(b.date))

    // Chart: Category Sales
    const categorySales: Record<string, number> = {}
    filteredData.forEach(item => {
        categorySales[item.category] = (categorySales[item.category] || 0) + item.total_amount
    })
    const categoryData = Object.entries(categorySales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)

    // Chart: Sub-Category Sales (Top 10)
    const subCategorySales: Record<string, number> = {}
    filteredData.forEach(item => {
        subCategorySales[item.sub_category] = (subCategorySales[item.sub_category] || 0) + item.total_amount
    })
    const subCategoryData = Object.entries(subCategorySales)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10) // Top 10

    // 5. Product Performance Data
    const productPerformance = useMemo(() => {
        const productStats: Record<string, {
            sku: string
            name: string
            category: string
            sub_category: string
            revenue: number
            units: number
            orders: Set<string>
            isNew: boolean
        }> = {}

        filteredData.forEach(item => {
            if (!productStats[item.sku]) {
                productStats[item.sku] = {
                    sku: item.sku,
                    name: item.product_name,
                    category: item.category,
                    sub_category: item.sub_category,
                    revenue: 0,
                    units: 0,
                    orders: new Set(),
                    isNew: item.isNewProduct
                }
            }
            productStats[item.sku].revenue += item.total_amount
            productStats[item.sku].units += Number(item.quantity)
            productStats[item.sku].orders.add(item.order_id)
        })

        return Object.values(productStats)
            .map(p => ({
                ...p,
                orders: p.orders.size
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 200) // Limit for performance
    }, [filteredData])

    // Extract unique options for filters
    const categories = Array.from(new Set(processedData.map(d => d.category))).sort()
    const subCategories = Array.from(new Set(processedData
        .filter(d => categoryFilter === "ALL" || d.category === categoryFilter)
        .map(d => d.sub_category)
    )).sort()

    // Sync Handler
    const handleSync = async () => {
        setSyncing(true)
        try {
            await fetch('/api/integrations/zortout/sync')
            router.refresh()
        } catch (error) {
            console.error("Sync failed", error)
        } finally {
            setSyncing(false)
        }
    }

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto py-8 px-4 text-foreground">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sales Dashboard</h1>
                    <p className="text-muted-foreground mt-1">Full Year Analysis & New Product Impact</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSync} disabled={syncing} variant="outline">
                        <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Orders'}
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 p-4 bg-muted/20 rounded-lg border items-end">
                <div className="space-y-2">
                    <span className="text-sm font-medium flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Period</span>
                    <Select value={periodFilter} onValueChange={setPeriodFilter}>
                        <SelectTrigger className="w-[180px] bg-background">
                            <SelectValue placeholder="Select Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="TODAY">Today</SelectItem>
                            <SelectItem value="YESTERDAY">Yesterday</SelectItem>
                            <SelectItem value="THIS_WEEK">This Week</SelectItem>
                            <SelectItem value="LAST_WEEK">Last Week</SelectItem>
                            <SelectItem value="THIS_MONTH">This Month</SelectItem>
                            <SelectItem value="LAST_MONTH">Last Month</SelectItem>
                            <SelectItem value="THIS_YEAR">This Year (YTD)</SelectItem>
                            <SelectItem value="LAST_YEAR">Last Year</SelectItem>
                            <SelectItem value="LAST_30_DAYS">Last 30 Days</SelectItem>
                            <SelectItem value="LAST_90_DAYS">Last 90 Days</SelectItem>
                            <SelectItem value="ALL">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <span className="text-sm font-medium flex items-center gap-1"><Filter className="w-3 h-3" /> Status</span>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px] bg-background">
                            <SelectValue placeholder="Product Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Products</SelectItem>
                            <SelectItem value="NEW">New (2026)</SelectItem>
                            <SelectItem value="EXISTING">Existing Catalog</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <span className="text-sm font-medium">Category</span>
                    <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setSubCategoryFilter("ALL"); }}>
                        <SelectTrigger className="w-[180px] bg-background">
                            <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Categories</SelectItem>
                            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <span className="text-sm font-medium">Sub-Category</span>
                    <Select value={subCategoryFilter} onValueChange={setSubCategoryFilter}>
                        <SelectTrigger className="w-[180px] bg-background">
                            <SelectValue placeholder="All Sub-Categories" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Sub-Categories</SelectItem>
                            {subCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {/* Product Name Search */}
                <div className="space-y-2">
                    <span className="text-sm font-medium flex items-center gap-1">
                        <Search className="w-3 h-3" /> Search Product
                    </span>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Name or SKU..."
                            className="h-10 w-[200px] rounded-md border border-input bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="ml-auto text-sm text-muted-foreground pb-2">
                    Showing {filteredData.length} records
                </div>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">฿{totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-muted-foreground">{statusFilter === "ALL" ? "Total sales" : `Sales from ${statusFilter.toLowerCase()} products`}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New Product Revenue</CardTitle>
                        <Rocket className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">฿{newProductRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <p className="text-xs text-muted-foreground">{revenueShare.toFixed(1)}% of displayed revenue</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{uniqueOrders.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 1: Trend & Category */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Sales Trend (New 2026 Impact)</CardTitle>
                        <CardDescription>New product performance vs Total Sales ({periodFilter.replace(/_/g, ' ').toLowerCase()})</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString()}`} />
                                <Legend />
                                <Bar dataKey="total" fill="#f3f4f6" name="Total Market" barSize={20} radius={[4, 4, 0, 0]} />
                                <Line type="monotone" dataKey="existing" stroke="#8884d8" name="Existing" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="new" stroke="#16a34a" name="New 2026" strokeWidth={3} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sales by Category</CardTitle>
                        <CardDescription>Top revenue generating categories</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={categoryData} margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString()}`} />
                                <Bar dataKey="value" fill="#0088FE" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2: Sub-Category & Top Items */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Top Sub-Categories</CardTitle>
                        <CardDescription>Highest revenue sub-categories</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={subCategoryData} margin={{ left: 100 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString()}`} />
                                <Bar dataKey="value" fill="#FFBB28" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Revenue Mix</CardTitle>
                        <CardDescription>New vs Existing Share</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'New Products', value: newProductRevenue },
                                        { name: 'Existing Products', value: totalRevenue - newProductRevenue }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }: any) => `${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    <Cell fill="#82ca9d" />
                                    <Cell fill="#8884d8" />
                                </Pie>
                                <Tooltip formatter={(value: any) => `฿${Number(value).toLocaleString()}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Product Sales Table */}
            <Card className="col-span-full">
                <CardHeader>
                    <CardTitle>Product Performance</CardTitle>
                    <CardDescription>
                        {searchQuery
                            ? `Searching "${searchQuery}" — ${productPerformance.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(searchQuery.toLowerCase())).length} result(s)`
                            : `Detailed sales breakdown by product (Top 200)`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full caption-bottom text-sm text-left">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground w-[400px]">Product / SKU</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Category</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Orders</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Units Sold</th>
                                    <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Total Revenue</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {productPerformance
                                    .filter(product => {
                                        if (!searchQuery) return true
                                        const q = searchQuery.toLowerCase()
                                        return (
                                            product.name?.toLowerCase().includes(q) ||
                                            product.sku?.toLowerCase().includes(q)
                                        )
                                    })
                                    .map((product) => (
                                        <tr key={product.sku} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <td className="p-4 align-middle font-medium">
                                                <div className="flex flex-col">
                                                    <span className="flex items-center gap-2">
                                                        {product.name}
                                                        {product.isNew && (
                                                            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-100 text-green-800 shadow hover:bg-green-100/80">
                                                                New
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{product.sku}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col">
                                                    <span>{product.category}</span>
                                                    <span className="text-xs text-muted-foreground">{product.sub_category}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle text-right">{product.orders.toLocaleString()}</td>
                                            <td className="p-4 align-middle text-right">{product.units.toLocaleString()}</td>
                                            <td className="p-4 align-middle text-right font-bold">฿{product.revenue.toLocaleString()}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
