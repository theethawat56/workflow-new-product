"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateTemplateTaskAction } from "@/app/actions/template"

interface Props {
    tasks: any[]
    templateId: string
}

export function TemplateTasksTable({ tasks, templateId }: Props) {
    const handleUpdate = async (taskCode: string, field: string, value: any) => {
        const res = await updateTemplateTaskAction(templateId, taskCode, { [field]: value })
        if (!res.success) alert(res.message)
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Offset (Days)</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Depends On</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map(task => (
                        <TableRow key={task.task_code}>
                            <TableCell>{task.task_code}</TableCell>
                            <TableCell>{task.task_name}</TableCell>
                            <TableCell>
                                <Input
                                    type="number"
                                    defaultValue={task.offset_days}
                                    className="w-20"
                                    onBlur={e => {
                                        if (e.target.value !== task.offset_days)
                                            handleUpdate(task.task_code, 'offset_days', e.target.value)
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                <Input
                                    type="number"
                                    defaultValue={task.duration_days}
                                    className="w-20"
                                    onBlur={e => {
                                        if (e.target.value !== task.duration_days)
                                            handleUpdate(task.task_code, 'duration_days', e.target.value)
                                    }}
                                />
                            </TableCell>
                            <TableCell>
                                <Input
                                    defaultValue={task.depends_on}
                                    onBlur={e => {
                                        if (e.target.value !== task.depends_on)
                                            handleUpdate(task.task_code, 'depends_on', e.target.value)
                                    }}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
