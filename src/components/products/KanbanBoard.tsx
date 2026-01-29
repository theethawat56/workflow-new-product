"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
// import { ProductTask } from "@/lib/db/schema" // If available, else Type locally
import { TaskDetailSheet } from "@/components/products/TaskDetailSheet"

interface ProductTask {
    product_task_id: string
    product_id: string
    task_name: string
    status: string
    phase: string
    owner_role?: string
    notes?: string
    task_code?: string
}

interface KanbanBoardProps {
    tasks: ProductTask[]
}

const COLUMNS = [
    { id: "todo", label: "To Do", statuses: ["NotStarted", "Blocked"] },
    { id: "inprogress", label: "In Progress", statuses: ["InProgress", "QA", "Review"] },
    { id: "done", label: "Done", statuses: ["Approved", "Done"] },
]

export function KanbanBoard({ tasks }: KanbanBoardProps) {
    const [selectedTask, setSelectedTask] = useState<ProductTask | null>(null)

    const getColumnTasks = (statusList: string[]) => {
        return tasks.filter(t => statusList.includes(t.status || "NotStarted"))
    }

    return (
        <>
            <div className="flex h-[calc(100vh-200px)] gap-6 overflow-x-auto pb-4">
                {COLUMNS.map((col) => {
                    const colTasks = getColumnTasks(col.statuses)

                    return (
                        <div key={col.id} className="min-w-[300px] w-1/3 flex flex-col gap-4">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="font-medium text-sm text-foreground uppercase tracking-wide">
                                    {col.label}
                                </h3>
                                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                    {colTasks.length}
                                </span>
                            </div>

                            <div className="flex-1 bg-secondary/30 rounded-xl p-2 space-y-3 overflow-y-auto">
                                {colTasks.map((task) => (
                                    <Card
                                        key={task.product_task_id}
                                        className="p-4 shadow-sm border-none bg-white hover:shadow-md transition-all cursor-pointer hover:border-primary/20 hover:ring-1 hover:ring-primary/20"
                                        onClick={() => setSelectedTask(task)}
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-medium text-foreground leading-snug">
                                                    {task.task_name}
                                                </p>
                                                {/* Priority Dot */}
                                                {task.status === "Blocked" && (
                                                    <div className="h-2 w-2 rounded-full bg-destructive shrink-0" title="Blocked" />
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 font-normal border-border text-muted-foreground">
                                                    {task.phase}
                                                </Badge>

                                                {/* Placeholder Avatar */}
                                                <div className="h-6 w-6 rounded-full bg-sidebar flex items-center justify-center text-[10px] text-muted-foreground border border-white ring-1 ring-white shadow-sm">
                                                    {task.owner_role?.[0] || "?"}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {selectedTask && (
                <TaskDetailSheet
                    task={selectedTask}
                    open={!!selectedTask}
                    onOpenChange={(open) => !open && setSelectedTask(null)}
                />
            )}
        </>
    )
}
