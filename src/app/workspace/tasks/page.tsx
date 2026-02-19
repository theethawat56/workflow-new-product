
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { listPendingTasks } from "@/lib/workspace/tools"
import Link from "next/link"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"

// Ensure dynamic rendering
export const dynamic = 'force-dynamic'

export default async function TasksPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin")
    }

    // Default fetch: all pending tasks (page 1, limit 50)
    const { tasks } = await listPendingTasks({ page: 1, pageSize: 50 })

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">My Tasks</h2>
                {/* Filter controls would go here */}
            </div>

            <div className="space-y-4">
                {tasks.map((task, i) => (
                    <Card key={i} className="hover:bg-muted/50 transition-colors">
                        <div className="flex items-center p-4 gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={task.status === 'Done' ? 'default' : 'outline'}>
                                        {task.status || 'Todo'}
                                    </Badge>
                                    <span className="font-semibold">{task.task_name}</span>
                                </div>
                                <div className="text-sm text-muted-foreground flex gap-4">
                                    <span>{task.product_id}</span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                                    </span>
                                </div>
                            </div>
                            <div className="text-sm">
                                {task.owner_email && (
                                    <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                                        {task.owner_email.split('@')[0]}
                                    </span>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {tasks.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    No pending tasks found.
                </div>
            )}
        </div>
    )
}
