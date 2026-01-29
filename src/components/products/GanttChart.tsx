"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Props {
    tasks: any[]
}

export function GanttChart({ tasks }: Props) {
    if (tasks.length === 0) return <div className="text-muted-foreground text-sm p-4">No tasks to display in Gantt view.</div>

    // Sort tasks by start date
    const sortedTasks = [...tasks].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

    // Determine range
    // Filter out invalid dates
    const validTasks = startDatesAndDueDates(sortedTasks)
    if (validTasks.length === 0) return <div className="text-muted-foreground text-sm p-4">Tasks have missing dates.</div>

    const startDates = validTasks.map(t => new Date(t.start_date).getTime())
    const dueDates = validTasks.map(t => new Date(t.due_date).getTime())
    const minDate = new Date(Math.min(...startDates))
    const maxDate = new Date(Math.max(...dueDates))

    // Add buffer
    minDate.setDate(minDate.getDate() - 3)
    maxDate.setDate(maxDate.getDate() + 7)

    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) || 1
    const dayWidth = 44 // Widened slightly for breathability

    return (
        <Card className="p-0 border-none shadow-sm bg-white overflow-hidden rounded-xl">
            <ScrollArea className="w-full h-[600px] whitespace-nowrap">
                <div style={{ width: `${totalDays * dayWidth}px`, minWidth: '100%' }} className="relative bg-[#F8F7F3]/50">

                    {/* Header: Months/Days */}
                    <div className="flex border-b border-border/60 h-12 items-center sticky top-0 z-20 bg-[#F2F0EA] text-[#3A3A3A]">
                        {Array.from({ length: totalDays }).map((_, i) => {
                            const date = new Date(minDate)
                            date.setDate(date.getDate() + i)
                            const day = date.getDate()
                            const isMonthStart = day === 1
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6

                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex-shrink-0 border-r border-border/40 text-[11px] flex flex-col items-center justify-center h-full transition-colors",
                                        isMonthStart ? "font-semibold bg-white text-primary" : "text-muted-foreground",
                                        isWeekend && !isMonthStart ? "bg-[#F8F7F3]" : ""
                                    )}
                                    style={{ width: `${dayWidth}px` }}
                                >
                                    {isMonthStart ? (
                                        <span className="uppercase tracking-wider text-[10px]">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
                                    ) : (
                                        <span>{day}</span>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Grid Background Lines (Optional, keeps it cleaner if minimal) */}
                    <div className="absolute inset-0 z-0 flex pointer-events-none pt-12">
                        {Array.from({ length: totalDays }).map((_, i) => (
                            <div key={i} className="border-r border-border/20 h-full flex-shrink-0" style={{ width: `${dayWidth}px` }} />
                        ))}
                    </div>

                    {/* Tasks */}
                    <div className="relative z-10 py-6 space-y-3 px-2">
                        {validTasks.map(task => {
                            const start = new Date(task.start_date).getTime()
                            const due = new Date(task.due_date).getTime()
                            const offset = Math.ceil((start - minDate.getTime()) / (1000 * 60 * 60 * 24))
                            const duration = Math.ceil((due - start) / (1000 * 60 * 60 * 24)) || 1

                            // Color Logic based on Status/Phase
                            const isDone = task.status === 'Done' || task.status === 'Approved'
                            const isBlocked = task.status === 'Blocked'
                            const isInProgress = task.status === 'InProgress'

                            let barClass = "bg-secondary text-foreground border border-border" // Default
                            if (isDone) barClass = "bg-success/90 text-white border-transparent shadow-sm"
                            if (isInProgress) barClass = "bg-primary/90 text-white border-transparent shadow-sm"
                            if (isBlocked) barClass = "bg-destructive/80 text-white border-transparent shadow-sm"

                            return (
                                <div key={task.product_task_id} className="relative h-9 flex items-center group">
                                    <div
                                        className={cn(
                                            "absolute h-7 rounded-sm px-3 text-xs flex items-center overflow-hidden whitespace-nowrap transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer",
                                            barClass
                                        )}
                                        style={{
                                            left: `${offset * dayWidth}px`,
                                            width: `${Math.max(duration * dayWidth, 4)}px`
                                        }}
                                        title={`${task.task_name} (${task.start_date} - ${task.due_date})`}
                                    >
                                        <span className="truncate font-medium drop-shadow-sm">{task.task_name}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <ScrollBar orientation="horizontal" className="h-3" />
            </ScrollArea>
        </Card>
    )
}

function startDatesAndDueDates(tasks: any[]) {
    return tasks.filter(t => t.start_date && t.due_date && !isNaN(new Date(t.start_date).getTime()) && !isNaN(new Date(t.due_date).getTime()))
}
