import { findAll } from "@/lib/db/adapter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Package, Clock } from "lucide-react"

interface Product {
    product_id: string
    product_name: string
    launch_month: string
    status: string
    sku_code: string
}

export default async function DashboardPage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect("/login")

    const products = await findAll<Product>("products")

    // 1. Monthly Launch Count
    const launchCounts: Record<string, number> = {}
    products.forEach(p => {
        if (p.launch_month) {
            launchCounts[p.launch_month] = (launchCounts[p.launch_month] || 0) + 1
        }
    })
    // Sort months chronologically
    const monthOrder = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    const sortedMonths = Object.keys(launchCounts).sort((a, b) => {
        return monthOrder.indexOf(a.toUpperCase()) - monthOrder.indexOf(b.toUpperCase())
    })

    // 2. Launch This Month
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' }) // or match format in DB
    // Let's assume DB stores "January", "February" etc or "Jan", "Feb"
    // We'll filter loosely for now or strict if format known. 
    // Assuming format from schema is free text or specific month name

    // Debug: check format if needed, but for now assuming full month Name
    const launchingThisMonth = products.filter(p =>
        p.launch_month && p.launch_month.includes(currentMonth)
    )

    // 3. Products Process (Not Launched, Not Draft - or just Active/In Progress)
    // "On Process" usually means Active working.
    const inProcessProducts = products.filter(p => p.status === 'Active' || p.status === 'InProgress')

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto py-8 text-foreground">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-medium tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                    Overview of product launches and active workflows.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

                {/* 1. Monthly Launches Card */}
                <Card className="shadow-sm border-none bg-white col-span-1 lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Monthly Launches
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {sortedMonths.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No limits scheduled.</p>
                            ) : (
                                sortedMonths.map(month => (
                                    <div key={month} className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-[#3A3A3A]">{month}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 bg-primary/20 rounded-full w-24 overflow-hidden">
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{ width: `${Math.min((launchCounts[month] / 10) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-muted-foreground w-6 text-right">{launchCounts[month]}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Launching This Month */}
                <Card className="shadow-sm border-none bg-white col-span-1 lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Launching in {currentMonth}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {launchingThisMonth.length > 0 ? (
                                launchingThisMonth.map(p => (
                                    <div key={p.product_id} className="flex items-center justify-between border-b border-border/50 last:border-0 pb-2 last:pb-0">
                                        <div>
                                            <p className="font-medium text-sm text-[#3A3A3A] truncate max-w-[150px]">{p.product_name}</p>
                                            <p className="text-[10px] text-muted-foreground">{p.sku_code}</p>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground font-mono">
                                            {p.status}
                                        </Badge>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground py-4 text-center">No products launching this month.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Products In Process */}
                <Card className="shadow-sm border-none bg-white col-span-1 lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Active Workflows
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                            {inProcessProducts.length > 0 ? (
                                inProcessProducts.map(p => (
                                    <div key={p.product_id} className="group flex items-center justify-between p-2 hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer">
                                        <div>
                                            <p className="font-medium text-sm text-foreground">{p.product_name}</p>
                                            <p className="text-xs text-muted-foreground">{p.launch_month || "No date"}</p>
                                        </div>
                                        <div className="h-2 w-2 rounded-full bg-warning" title="In Progress" />
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">No active workflows.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
