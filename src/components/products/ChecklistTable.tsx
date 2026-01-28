"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { updateTaskAction } from "@/app/actions/task"
// import { useToast } from "@/components/ui/use-toast" // Removed unused import
import { cn } from "@/lib/utils"

interface Props {
    tasks: any[]
}

export function ChecklistTable({ tasks }: Props) {
    // We rely on optimistic updates or just server revalidation. 
    // For MVP, trigger action -> revalidatePath handles refresh.
    // We can add loading state per row if needed.
    const [updating, setUpdating] = useState<string | null>(null)

    const handleUpdate = async (taskId: string, productId: string, field: string, value: any) => {
        setUpdating(taskId)
        const res = await updateTaskAction(taskId, productId, { [field]: value })
        if (!res.success) {
            alert("Failed to update task")
        }
        setUpdating(null)
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Task</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Task Name</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action / Notes</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map(task => (
                        <TableRow key={task.product_task_id}>
                            <TableCell className="font-medium text-xs text-muted-foreground">{task.task_code}</TableCell>
                            <TableCell><Badge variant="outline">{task.phase}</Badge></TableCell>
                            <TableCell className="font-medium">{task.task_name}</TableCell>
                            <TableCell>
                                <Input
                                    type="date"
                                    defaultValue={task.start_date}
                                    className="w-[130px]"
                                    onBlur={(e) => {
                                        if (e.target.value !== task.start_date) {
                                            handleUpdate(task.product_task_id, task.product_id, 'start_date', e.target.value)
                                        }
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                <Input
                                    type="date"
                                    defaultValue={task.due_date}
                                    className="w-[130px]"
                                    onBlur={(e) => {
                                        if (e.target.value !== task.due_date) {
                                            handleUpdate(task.product_task_id, task.product_id, 'due_date', e.target.value)
                                        }
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                <Input
                                    defaultValue={task.owner_email}
                                    className="w-[160px]"
                                    onBlur={(e) => {
                                        if (e.target.value !== task.owner_email) {
                                            handleUpdate(task.product_task_id, task.product_id, 'owner_email', e.target.value)
                                        }
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                <Select
                                    defaultValue={task.status}
                                    onValueChange={(val) => handleUpdate(task.product_task_id, task.product_id, 'status', val)}
                                >
                                    <SelectTrigger className={cn("w-[120px]",
                                        task.status === 'Done' ? "bg-green-100 text-green-800" :
                                            task.status === 'Blocked' ? "bg-red-100 text-red-800 border-red-200" : ""
                                    )}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NotStarted">Not Started</SelectItem>
                                        <SelectItem value="InProgress">In Progress</SelectItem>
                                        <SelectItem value="QA">QA</SelectItem>
                                        <SelectItem value="Review">Review</SelectItem>
                                        <SelectItem value="Approved">Approved</SelectItem>
                                        <SelectItem value="Done">Done</SelectItem>
                                        <SelectItem value="Blocked">Blocked</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell>
                                {task.input_type === 'note' ? (
                                    <Input
                                        placeholder="Add note..."
                                        defaultValue={task.notes}
                                        onBlur={(e) => handleUpdate(task.product_task_id, task.product_id, 'notes', e.target.value)}
                                        className="border-blue-200 bg-blue-50/50"
                                    />
                                ) : task.input_type === 'file' ? (
                                    <div className="flex items-center gap-2">
                                        {/* Simple Link Input for now */}
                                        <Button variant="outline" size="sm" onClick={() => {
                                            const url = prompt("Enter Drive URL for " + task.task_name)
                                            if (url) {
                                                // We need to call addAttachmentAction, but can't easily import it here if client, 
                                                // actually we can. Use a hidden handler or better UI later.
                                                // For MVP, just alert to use Files tab or implement proper dialog.
                                                // Let's assume standard behavior for now: 
                                                alert("Please use the 'Files' tab to attach files for this task.")
                                            }
                                        }}>
                                            Upload
                                        </Button>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
