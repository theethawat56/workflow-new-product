"use client"

import { Card } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface Props {
    tasks: any[]
}

export function GanttChart({ tasks }: Props) {
    if (tasks.length === 0) return <div>No tasks to display.</div>

    // Sort tasks by start date
    const sortedTasks = [...tasks].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

    // Determine range
    const startDates = tasks.map(t => new Date(t.start_date).getTime())
    const dueDates = tasks.map(t => new Date(t.due_date).getTime())
    const minDate = new Date(Math.min(...startDates))
    const maxDate = new Date(Math.max(...dueDates))

    // Add buffer
    minDate.setDate(minDate.getDate() - 5)
    maxDate.setDate(maxDate.getDate() + 10)

    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
    const dayWidth = 40 // px

    return (
        <Card className="p-4 border">
            <ScrollArea className="w-full h-[500px] whitespace-nowrap rounded-md border">
                <div style={{ width: `${totalDays * dayWidth}px`, minWidth: '100%' }} className="relative">
                    {/* Header: Months/Days */}
                    <div className="flex border-b h-10 items-center sticky top-0 z-10 bg-white shadow-sm">
                        {Array.from({ length: totalDays }).map((_, i) => {
                            const date = new Date(minDate)
                            date.setDate(date.getDate() + i)
                            const day = date.getDate()
                            const isMonthStart = day === 1
                            return (
                                <div
                                    key={i}
                                    className={`flex-shrink-0 border-r text-[10px] flex items-center justify-center ${isMonthStart ? 'font-bold bg-muted' : ''}`}
                                    style={{ width: `${dayWidth}px` }}
                                >
                                    {isMonthStart ? date.toLocaleDateString('en-US', { month: 'short' }) : day}
                                </div>
                            )
                        })}
                    </div>

                    {/* Tasks */}
                    <div className="mt-4 space-y-2">
                        {sortedTasks.map(task => {
                            const start = new Date(task.start_date).getTime()
                            const due = new Date(task.due_date).getTime()
                            const offset = Math.ceil((start - minDate.getTime()) / (1000 * 60 * 60 * 24))
                            const duration = Math.ceil((due - start) / (1000 * 60 * 60 * 24)) || 1

                            return (
                                <div key={task.product_task_id} className="relative h-8 flex items-center group">
                                    <div
                                        className={`absolute h-6 rounded px-2 text-xs flex items-center text-white overflow-hidden whitespace-nowrap
                                            ${task.status === 'Done' ? 'bg-green-500' : 'bg-blue-500'}
                                        `}
                                        style={{
                                            left: `${offset * dayWidth}px`,
                                            width: `${duration * dayWidth}px`
                                        }}
                                        title={`${task.task_name} (${task.start_date} - ${task.due_date})`}
                                    >
                                        {task.task_name}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </Card>
    )
}
