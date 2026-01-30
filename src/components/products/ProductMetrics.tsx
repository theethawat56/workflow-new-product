"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Target } from "lucide-react"

interface Props {
    product: any
    tasks: any[]
}

export function ProductMetrics({ product, tasks }: Props) {
    // --- 1. Overall Progress (Weighted) ---
    // Rule: High=3, Medium=2, Low/Normal=1
    let totalWeight = 0
    let earnedWeight = 0

    tasks.forEach(t => {
        let w = 1
        if (t.priority === 'High' || t.priority === 'Critical') w = 3
        else if (t.priority === 'Medium') w = 2

        totalWeight += w
        if (t.status === 'Done') earnedWeight += w
    })

    const weightedCompletion = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0

    // --- 2. Time & Plan ---
    const targetDate = product.go_live_date ? new Date(product.go_live_date) : null
    const daysToLaunch = targetDate
        ? Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24))
        : null

    // Forecast: Max due date of remaining critical tasks
    const remainingTasks = tasks.filter(t => t.status !== 'Done')
    let forecastDate = targetDate

    if (remainingTasks.length > 0) {
        // Find max due date
        const maxDue = remainingTasks.reduce((max, t) => {
            const d = t.due_date ? new Date(t.due_date) : null
            return d && (!max || d > max) ? d : max
        }, null as Date | null)

        if (maxDue) forecastDate = maxDue
    }

    const varianceDays = (targetDate && forecastDate)
        ? Math.ceil((forecastDate.getTime() - targetDate.getTime()) / (1000 * 3600 * 24))
        : 0

    // --- 3. Risk Metrics ---
    let riskScore = 0
    const riskDrivers: string[] = []

    // +10 per Overdue Critical Task (Max 40)
    const overdueCritical = tasks.filter(t => {
        const isCritical = t.priority === 'High' || t.priority === 'Critical'
        const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'Done'
        return isCritical && isOverdue
    })
    const overdueScore = Math.min(overdueCritical.length * 10, 40)
    riskScore += overdueScore
    if (overdueCritical.length > 0) riskDrivers.push(`${overdueCritical.length} Critical Tasks Overdue`)

    // +15 per Blocked Task (Max 30)
    const blocked = tasks.filter(t => t.status === 'Blocked')
    const blockedScore = Math.min(blocked.length * 15, 30)
    riskScore += blockedScore
    if (blocked.length > 0) riskDrivers.push(`${blocked.length} Tasks Blocked`)

    // +20 if Milestone Missed
    const missedMilestones = tasks.filter(t => {
        const isMilestone = t.task_name.toLowerCase().includes('milestone') || t.phase === 'Launch'
        const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'Done'
        return isMilestone && isOverdue
    })
    if (missedMilestones.length > 0) {
        riskScore += 20
        riskDrivers.push("Milestone Missed")
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100)

    let riskColor = "text-green-600"
    if (riskScore > 30) riskColor = "text-yellow-600"
    if (riskScore > 60) riskColor = "text-red-600"


    // --- 4. Readiness by Function ---
    // Mapping roles to functions
    const roleMap: Record<string, string[]> = {
        "E-Commerce": ["Ecom"],
        "Marketing": ["Marketing"],
        "Operations": ["Ops", "PM"], // PM often drives Ops
        "CS / After-Sales": ["CS", "AfterService"],
        "Compliance": ["Admin", "Finance"] // Proxy for compliance usually
    }

    const readiness: { name: string, pct: number, total: number, done: number }[] = []

    Object.entries(roleMap).forEach(([label, roles]) => {
        const roleTasks = tasks.filter(t => roles.includes(t.owner_role || ""))
        if (roleTasks.length === 0) return // Skip empty functions

        const done = roleTasks.filter(t => t.status === 'Done').length
        const total = roleTasks.length
        readiness.push({
            name: label,
            pct: Math.round((done / total) * 100),
            total,
            done
        })
    })

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* 1. Completion */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Weighted Completion</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{weightedCompletion}%</div>
                        <Progress value={weightedCompletion} className="h-2 mt-2" />
                    </CardContent>
                </Card>

                {/* 2. Days to Launch */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Days to Launch</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{daysToLaunch !== null ? daysToLaunch : "N/A"}</div>
                        <p className="text-xs text-muted-foreground">Target: {product.go_live_date || "Not set"}</p>
                    </CardContent>
                </Card>

                {/* 3. Schedule Variance */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Schedule Variance</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${varianceDays > 0 ? "text-red-500" : "text-green-500"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${varianceDays > 0 ? "text-red-600" : "text-green-600"}`}>
                            {varianceDays > 0 ? `+${varianceDays}` : varianceDays} Days
                        </div>
                        <p className="text-xs text-muted-foreground">Forecast: {forecastDate?.toLocaleDateString() || "N/A"}</p>
                    </CardContent>
                </Card>

                {/* 4. Risk Score */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
                        <ShieldAlert className={`h-4 w-4 ${riskColor}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${riskColor}`}>{riskScore}/100</div>
                        <p className="text-xs text-muted-foreground">
                            {riskScore < 30 ? "Low Risk" : riskScore < 60 ? "Medium Risk" : "High Risk"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Risk Drivers */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Risk Drivers</CardTitle>
                        <CardDescription>Factors contributing to risk score</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {riskDrivers.length > 0 ? (
                            <ul className="space-y-2">
                                {riskDrivers.map((driver, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm font-medium text-red-600 bg-red-50 p-2 rounded">
                                        <ShieldAlert className="h-4 w-4" />
                                        {driver}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-green-600">
                                <CheckCircle2 className="h-10 w-10 mb-2" />
                                <p className="font-medium">All systems go!</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Readiness */}
                <Card>
                    <CardHeader>
                        <CardTitle>Launch Readiness</CardTitle>
                        <CardDescription>Progress by functional area</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {readiness.map((item) => (
                            <div key={item.name} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="text-muted-foreground">{item.done}/{item.total} ({item.pct}%)</span>
                                </div>
                                <Progress value={item.pct} className="h-2" />
                            </div>
                        ))}
                        {readiness.length === 0 && (
                            <p className="text-sm text-muted-foreground">No tasks assigned to standard roles yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div >
    )
}
