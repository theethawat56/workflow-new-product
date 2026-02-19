

import { findAll } from "@/lib/db/adapter"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    Users,
    BarChart3,
    Calendar,
    AlertTriangle,
    Briefcase,
    Layers
} from "lucide-react"

interface Product {
    product_id: string
    product_name: string
    launch_month: string
    status: string
    sku_code: string
    go_live_date?: string
    created_at?: string
    updated_at?: string
    category?: string
}

interface ProductTask {
    product_task_id: string
    product_id: string
    task_name: string
    phase: string
    status: string
    due_date?: string
    updated_at?: string
    owner_role?: string
    owner_email?: string
    blocker_reason?: string
    start_date?: string
}

export default async function DashboardPage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect("/login")

    // Fetch Data
    const products = await findAll<Product>("products")
    const tasks = await findAll<ProductTask>("product_tasks")

    // --- 0. Pipeline Overview Data ---
    const launchCounts: Record<string, number> = {}
    products.forEach(p => {
        if (p.launch_month) {
            launchCounts[p.launch_month] = (launchCounts[p.launch_month] || 0) + 1
        }
    })
    const monthOrder = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    const sortedMonths = Object.keys(launchCounts).sort((a, b) => {
        return monthOrder.indexOf(a.toUpperCase()) - monthOrder.indexOf(b.toUpperCase())
    })

    // Launch This Month
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' })
    const launchingThisMonth = products.filter(p =>
        p.launch_month && p.launch_month.toUpperCase().includes(currentMonth.toUpperCase().slice(0, 3))
    )

    // --- 1. Portfolio Metrics ---
    const activeProducts = products.filter(p => p.status === 'Active' || p.status === 'InProgress')

    // On-time Launch Forecast
    const onTimeProjects = activeProducts.filter(p => {
        if (!p.go_live_date) return true // No target, assume ok
        // Find "Launch" phase tasks or late tasks
        // Simplified logic: If any critical task is overdue > 7 days, it's late. 
        // Or if the specific "Launch" task due date > go_live_date.
        const pTasks = tasks.filter(t => t.product_id === p.product_id)
        const launchTask = pTasks.find(t => t.phase === 'Launch')

        if (launchTask && launchTask.due_date && new Date(launchTask.due_date) > new Date(p.go_live_date)) {
            return false
        }
        return true
    })
    const onTimeForecastPct = activeProducts.length > 0
        ? Math.round((onTimeProjects.length / activeProducts.length) * 100)
        : 100

    // Blocked Projects
    const blockedProjects = activeProducts.filter(p => {
        const pTasks = tasks.filter(t => t.product_id === p.product_id)
        return pTasks.some(t => t.status === 'Blocked')
    })

    // At-Risk Projects (Rule: Blocked OR Overdue > 3 days)
    const atRiskProjects = activeProducts.filter(p => {
        const pTasks = tasks.filter(t => t.product_id === p.product_id)
        const isBlocked = pTasks.some(t => t.status === 'Blocked')
        const hasSevereOverdue = pTasks.some(t => {
            if (t.status === 'Done' || !t.due_date) return false
            const diffTime = new Date().getTime() - new Date(t.due_date).getTime()
            const diffDays = diffTime / (1000 * 3600 * 24)
            return diffDays > 3
        })
        return isBlocked || hasSevereOverdue
    })

    // --- 2. Execution Velocity ---
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const completedTasks7d = tasks.filter(t => t.status === 'Done' && t.updated_at && new Date(t.updated_at) >= sevenDaysAgo).length
    const completedTasks14d = tasks.filter(t => t.status === 'Done' && t.updated_at && new Date(t.updated_at) >= fourteenDaysAgo).length

    // Overdue
    const openTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'Approved')
    const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < now)
    const overdueRate = openTasks.length > 0 ? Math.round((overdueTasks.length / openTasks.length) * 100) : 0

    // --- 3. Ownership & Workload ---
    // By Team (Role)
    const tasksByTeam: Record<string, number> = {}
    openTasks.forEach(t => {
        const role = t.owner_role || "Unassigned"
        tasksByTeam[role] = (tasksByTeam[role] || 0) + 1
    })

    // By Assignee (Email)
    const tasksByAssignee: Record<string, number> = {}
    openTasks.forEach(t => {
        const email = t.owner_email || "Unassigned"
        // Simple name extraction
        const name = email.split('@')[0]
        tasksByAssignee[name] = (tasksByAssignee[name] || 0) + 1
    })

    // Review Queue
    const reviewQueue = tasks.filter(t => t.status === 'Review')
    const reviewByTeam: Record<string, number> = {}
    reviewQueue.forEach(t => {
        const role = t.owner_role || "Unassigned"
        reviewByTeam[role] = (reviewByTeam[role] || 0) + 1
    })

    // --- 4. Time-to-launch ---
    // Avg Days to Launch (Launched Projects)
    const launchedProjects = products.filter(p => p.status === 'Launched' && p.go_live_date && p.created_at)
    // Group by category
    const launchDaysByCategory: Record<string, number[]> = {}

    launchedProjects.forEach(p => {
        const start = new Date(p.created_at!)
        // Use updated_at as proxy for actual launch if status is Launched
        const end = p.updated_at ? new Date(p.updated_at) : new Date()
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 3600 * 24))
        const cat = p.category || "Uncategorized"

        if (!launchDaysByCategory[cat]) launchDaysByCategory[cat] = []
        launchDaysByCategory[cat].push(days)
    })

    const avgLaunchDays: Record<string, number> = {}
    Object.keys(launchDaysByCategory).forEach(cat => {
        const days = launchDaysByCategory[cat]
        avgLaunchDays[cat] = Math.round(days.reduce((a, b) => a + b, 0) / days.length)
    })

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto py-8 px-4 text-foreground">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
                <p className="text-muted-foreground mt-1">Real-time insights on product pipeline and team performance.</p>
            </div>

            {/* 0. Pipeline Overview (Restored) */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Monthly Launches */}
                <Card className="shadow-sm border-none bg-white col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
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

                {/* Launching This Month */}
                <Card className="shadow-sm border-none bg-white col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
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

                {/* Active Workflows */}
                <Card className="shadow-sm border-none bg-white col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Active Workflows
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                            {products.filter(p => p.status === 'Active' || p.status === 'InProgress').length > 0 ? (
                                products.filter(p => p.status === 'Active' || p.status === 'InProgress').map(p => (
                                    <div key={p.product_id} className="group flex items-center justify-between p-2 hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer">
                                        <div>
                                            <p className="font-medium text-sm text-foreground">{p.product_name}</p>
                                            <p className="text-xs text-muted-foreground">{p.launch_month || "No date"}</p>
                                        </div>
                                        <div className="h-2 w-2 rounded-full bg-yellow-400" title="In Progress" />
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">No active workflows.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 1. Portfolio Health */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">On-time Forecast</CardTitle>
                        <Activity className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{onTimeForecastPct}%</div>
                        <p className="text-xs text-muted-foreground">Of active projects</p>
                        <Progress value={onTimeForecastPct} className="h-2 mt-2" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">At-Risk Projects</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{atRiskProjects.length}</div>
                        <p className="text-xs text-muted-foreground">Blocked or Overdue &gt; 3 days</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Blocked Projects</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{blockedProjects.length}</div>
                        <p className="text-xs text-muted-foreground">Critical path blocked</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Count</CardTitle>
                        <Briefcase className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeProducts.length}</div>
                        <p className="text-xs text-muted-foreground">Projects in flight</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">

                {/* 2. Execution Velocity */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Execution Velocity</CardTitle>
                        <CardDescription>Task accumulation and completion rates</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Completed (7d)</p>
                                    <p className="text-2xl font-bold">{completedTasks7d}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-muted-foreground">14-Day Trend</p>
                                <p className="text-sm font-bold text-green-600">
                                    {completedTasks14d > 0 ? ((completedTasks7d / completedTasks14d) * 100).toFixed(0) : 0}% of Prev Period
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>Overdue Rate</span>
                                <span className={overdueRate > 10 ? "text-red-500 font-bold" : "text-foreground"}>{overdueRate}%</span>
                            </div>
                            <Progress value={overdueRate} className="h-2 bg-slate-100" indicatorClassName={overdueRate > 10 ? "bg-red-500" : "bg-green-500"} />
                            <p className="text-xs text-muted-foreground text-right">{overdueTasks.length} / {openTasks.length} Open Tasks</p>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Workload by Team */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Workload by Team</CardTitle>
                        <CardDescription>Open tasks distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {Object.entries(tasksByTeam)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([team, count]) => (
                                <div key={team} className="flex items-center">
                                    <span className="w-32 text-sm font-medium truncate">{team}</span>
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden mx-2">
                                        <div className="h-full bg-blue-600" style={{ width: `${Math.min((count / 20) * 100, 100)}%` }} />
                                    </div>
                                    <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                                </div>
                            ))}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
                {/* 4. Review Queue */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Review Queue
                        </CardTitle>
                        <CardDescription>Tasks waiting for approval</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {reviewQueue.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Queue is empty. Good job!</p>
                            ) : (
                                Object.entries(reviewByTeam).map(([team, count]) => (
                                    <div key={team} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary">{team}</Badge>
                                        </div>
                                        <span className="font-bold">{count} Pending</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Time-to-Launch */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Avg Time-to-Launch
                        </CardTitle>
                        <CardDescription>Average days from Start to Launched</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {Object.keys(avgLaunchDays).length === 0 ? (
                            <p className="text-sm text-muted-foreground">No launch history data available.</p>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(avgLaunchDays).map(([cat, days]) => (
                                    <div key={cat} className="flex flex-col gap-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium">{cat}</span>
                                            <span className="text-muted-foreground">{days} Days</span>
                                        </div>
                                        <Progress value={Math.min((days / 120) * 100, 100)} className="h-2" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
