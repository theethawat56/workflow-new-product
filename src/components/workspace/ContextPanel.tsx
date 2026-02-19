"use client"

import * as React from "react"
import { X, Box, CheckSquare, Paperclip, TrendingUp, Calendar, Tag, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Product, Task, Attachment, SalesItem } from "@/lib/workspace/types"

interface ContextData {
    product: Product
    tasks: Task[]
    attachments: Attachment[]
    sales: SalesItem[]
}

interface ContextPanelProps {
    data?: ContextData | null
    onClose: () => void
}

export function ContextPanel({ data, onClose }: ContextPanelProps) {
    if (!data) return null
    const { product, tasks, attachments, sales } = data

    // Sales aggregation
    const totalSales = sales.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0)
    const totalQty = sales.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)

    return (
        <div className="w-80 border-l border-border bg-background flex flex-col h-full shrink-0">
            <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-semibold text-sm">Context: {product.sku_code}</h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <ScrollArea className="flex-1 p-4 bg-muted/5">
                <div className="space-y-4">
                    {/* Product Details */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Box className="h-4 w-4 text-primary" />
                                Product Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div className="font-semibold text-base">{product.product_name}</div>
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Status</span>
                                <span className="text-foreground">{product.status}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Launch</span>
                                <span className="text-foreground">{product.launch_month}</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> Price</span>
                                <span className="text-foreground">{product.price}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tasks */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <CheckSquare className="h-4 w-4 text-blue-500" />
                                Tasks ({tasks.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3">
                            {tasks.length === 0 ? (
                                <div className="text-muted-foreground text-xs italic">No tasks found.</div>
                            ) : (
                                tasks.slice(0, 5).map(task => (
                                    <div key={task.product_task_id} className="flex items-start gap-2">
                                        <div className={`h-4 w-4 border rounded mt-0.5 ${task.status === 'Done' ? 'bg-blue-500 border-blue-500' : ''}`} />
                                        <div>
                                            <div className={task.status === 'Done' ? 'line-through text-muted-foreground' : ''}>
                                                {task.task_name}
                                            </div>
                                            {task.due_date && (
                                                <div className="text-xs text-muted-foreground">Due: {task.due_date}</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Attachments */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Paperclip className="h-4 w-4 text-orange-500" />
                                Attachments ({attachments.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            {attachments.length === 0 ? (
                                <div className="text-muted-foreground text-xs italic">No attachments.</div>
                            ) : (
                                attachments.map(att => (
                                    <div key={att.attachment_id} className="flex items-center gap-2 overflow-hidden">
                                        <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        <a href={att.drive_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                                            {att.type} Link
                                        </a>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Sales */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                Sales (30 Days)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="bg-muted/30 p-2 rounded">
                                    <div className="text-xs text-muted-foreground">Units</div>
                                    <div className="font-bold text-lg">{totalQty}</div>
                                </div>
                                <div className="bg-muted/30 p-2 rounded">
                                    <div className="text-xs text-muted-foreground">Revenue</div>
                                    <div className="font-bold text-lg">{totalSales.toLocaleString()}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </ScrollArea>
        </div>
    )
}
