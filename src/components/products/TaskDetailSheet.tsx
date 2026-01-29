"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateTaskAction } from "@/app/actions/task"
import { cn } from "@/lib/utils"

interface TaskDetailProps {
    task: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TaskDetailSheet({ task, open, onOpenChange }: TaskDetailProps) {
    const [status, setStatus] = useState(task.status)
    const [notes, setNotes] = useState(task.notes || "")
    const [isLoading, setIsLoading] = useState(false)

    const handleSave = async () => {
        setIsLoading(true)
        await updateTaskAction(task.product_task_id, task.product_id, {
            status,
            notes
        })
        setIsLoading(false)
        onOpenChange(false)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[500px] bg-[#F8F7F3] p-0 flex flex-col gap-0 border-l border-border shadow-2xl">

                {/* Header */}
                <div className="p-6 pb-4 bg-white border-b border-border">
                    <SheetTitle className="text-xl font-medium text-foreground leading-snug">
                        {task.task_name}
                    </SheetTitle>
                    <SheetDescription className="mt-1.5 flex items-center gap-2">
                        <Badge variant="outline" className="font-normal text-muted-foreground bg-transparent">
                            {task.phase}
                        </Badge>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground font-mono">{task.task_code}</span>
                    </SheetDescription>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Status & Properties */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 ring-2 ring-white">
                                <AvatarFallback className="text-xs bg-sidebar text-foreground">
                                    {task.owner_role?.[0] || "?"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                                <p className="font-medium text-foreground">{task.owner_role || "Unassigned"}</p>
                                <p className="text-xs text-muted-foreground">Owner</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="w-[140px] h-8 bg-white border-border shadow-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NotStarted">Not Started</SelectItem>
                                    <SelectItem value="InProgress">In Progress</SelectItem>
                                    <SelectItem value="Blocked">Blocked</SelectItem>
                                    <SelectItem value="Done">Done</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator className="bg-border/50" />

                    {/* Notes / "Comments" Area */}
                    <div className="space-y-4">
                        <Label className="text-sm font-medium text-muted-foreground">Notes & Comments</Label>
                        <div className="relative">
                            <textarea
                                className="w-full min-h-[150px] bg-transparent resize-none focus:outline-none text-foreground leading-loose text-sm p-2 border-b border-border focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                                placeholder="Write details here..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                style={{
                                    backgroundImage: "linear-gradient(transparent 95%, #E0E0E0 95%)",
                                    backgroundSize: "100% 2rem",
                                    lineHeight: "2rem"
                                }}
                            />
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-sidebar/50 backdrop-blur-sm flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isLoading} className="bg-primary text-primary-foreground hover:opacity-90">
                        {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                </div>

            </SheetContent>
        </Sheet>
    )
}
