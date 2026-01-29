import { findAll } from "@/lib/db/adapter"
import { Card, CardContent } from "@/components/ui/card"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { redirect } from "next/navigation"
import { CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Types
interface ActivityLog {
    log_id: string
    action: string
    entity_type: string
    actor_email: string
    timestamp: string
}

interface ProductTask {
    product_task_id: string
    status: string
    owner_email: string
}

export default async function DashboardPage() {
    const session = await getServerSession(authOptions)
    if (!session) {
        redirect("/login")
    }

    const userEmail = session.user?.email
    const tasks = await findAll<ProductTask>("product_tasks")
    const activities = await findAll<ActivityLog>("activity_log")

    // Filter tasks for this user (or all if admin? Let's show personal context mostly)
    // Actually for a "Team Dashboard", maybe high level + personal.
    // Spec said: "12 Tasks Completed", "5 In Progress". Let's assume global for now or filter by user if easy.
    // Let's do Global for Team Dashboard context, but maybe highlight "My Tasks" later.

    const completed = tasks.filter(t => t.status === "Done").length
    const inProgress = tasks.filter(t => t.status === "InProgress").length
    const blocked = tasks.filter(t => t.status === "Blocked").length

    // Sort activities by timestamp desc (assuming ISO string)
    const recentActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto py-8">
            {/* Hero Section */}
            <div className="space-y-2">
                <h1 className="text-3xl font-medium tracking-tight text-foreground">
                    สวัสดี, {session.user?.name || "Team"}
                </h1>
                <p className="text-muted-foreground text-lg">
                    Here's what's happening today. You have <span className="text-foreground font-medium">{inProgress} active tasks</span>.
                </p>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Tasks Completed</p>
                            <p className="text-4xl font-normal text-foreground">{completed}</p>
                            <span className="text-xs text-muted-foreground">This Week</span>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center text-success">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                            <p className="text-4xl font-normal text-foreground">{inProgress}</p>
                            <span className="text-xs text-muted-foreground">Active Now</span>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-warning/20 flex items-center justify-center text-warning-foreground">
                            <Clock className="h-6 w-6 text-yellow-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-white">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Blockers</p>
                            <p className="text-4xl font-normal text-destructive">{blocked}</p>
                            <span className="text-xs text-muted-foreground">Requires Attention</span>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <div className="space-y-4">
                <h2 className="text-xl font-medium text-foreground">Recent Activity</h2>
                <div className="bg-white rounded-xl p-6 shadow-sm space-y-6">
                    {recentActivities.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No recent activity.</p>
                    ) : (
                        recentActivities.map((log) => (
                            <div key={log.log_id} className="flex gap-4 items-start">
                                <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-sm text-foreground leading-relaxed">
                                        <span className="font-medium">{log.actor_email}</span> {log.action.toLowerCase()} on <span className="font-medium">{log.entity_type}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(log.timestamp).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
