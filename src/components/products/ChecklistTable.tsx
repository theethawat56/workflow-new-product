"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
// import { updateTaskAction } from "@/app/actions/task" // No longer needed directly here for most things
import { TaskDetailSheet } from "./TaskDetailSheet"
import { FileText, Calendar, User, MoreHorizontal } from "lucide-react"

interface Props {
    tasks: any[]
}

export function ChecklistTable({ tasks }: Props) {
    const [selectedTask, setSelectedTask] = useState<any>(null)

    // Helper to format date cleanly
    const formatDate = (dateStr: string) => {
        if (!dateStr) return <span className="text-muted-foreground">-</span>
        return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    }

    return (
        <>
            <div className="rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[100px]">Task</TableHead>
                            <TableHead>Phase</TableHead>
                            <TableHead className="min-w-[200px]">Task Name</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>Due</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px]">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.map(task => (
                            <TableRow
                                key={task.product_task_id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors group"
                                onClick={() => setSelectedTask(task)}
                            >
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {task.task_code}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="font-normal text-xs bg-white">
                                        {task.phase}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-medium text-foreground">
                                    {task.task_name}
                                    {task.notes && (
                                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground truncate max-w-[250px]">
                                            <FileText className="h-3 w-3" />
                                            <span className="truncate">{task.notes}</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                                        {formatDate(task.start_date)}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                                        {formatDate(task.due_date)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-xs border border-slate-200">
                                            {task.owner_email ? task.owner_email[0].toUpperCase() : <User className="h-3 w-3 text-muted-foreground" />}
                                        </div>
                                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                            {task.owner_email || "Unassigned"}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant="secondary"
                                        className={cn("font-medium border",
                                            task.status === 'Done' ? "bg-green-50 text-green-700 border-green-200" :
                                                task.status === 'Blocked' ? "bg-red-50 text-red-700 border-red-200" :
                                                    task.status === 'InProgress' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                        "bg-slate-50 text-slate-600 border-slate-200"
                                        )}
                                    >
                                        {task.status === 'NotStarted' ? 'Not Started' :
                                            task.status === 'InProgress' ? 'In Progress' :
                                                task.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
