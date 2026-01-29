"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChecklistTable } from "@/components/products/ChecklistTable"
import { GanttChart } from "@/components/products/GanttChart"
import { KanbanBoard } from "@/components/products/KanbanBoard"
import { AttachmentsList } from "@/components/products/AttachmentsList"
import { EditProductDialog } from "@/components/products/EditProductDialog"
import { deleteProductAction } from "@/app/actions/product"
import { AdminButtons } from "@/components/products/AdminButtons"
import { FinancialCards, CostPriceCard } from "@/components/products/FinancialCards"

interface Props {
    product: any
    tasks: any[]
    attachments: any[]
}

export function ProductDetailView({ product, tasks, attachments }: Props) {
    const router = useRouter()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return

        setIsDeleting(true)
        const res = await deleteProductAction(product.product_id)
        if (res.success) {
            router.push("/products")
        } else {
            alert("Failed to delete: " + res.message)
            setIsDeleting(false)
        }
    }

    // Stats
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.status === "Done").length
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        {product.product_name}
                        <Badge variant="outline">{product.status}</Badge>
                    </h1>
                    <p className="text-muted-foreground">{product.sku_code} • {product.sales_channel}</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Only Admin can Edit/Delete */}
                    <AdminButtons productId={product.product_id} isDeleting={isDeleting} onDelete={handleDelete} product={product} />

                    <div className="text-right">
                        <div className="text-sm font-medium text-muted-foreground">Progress</div>
                        <div className="text-2xl font-bold">{progress}%</div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="checklist">Checklist</TabsTrigger>
                    <TabsTrigger value="kanban">Kanban</TabsTrigger>
                    <TabsTrigger value="gantt">Gantt</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                    {/* Activity coming later */}
                </TabsList>

                <TabsContent value="overview">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Go Live Date</CardTitle></CardHeader>
                            <CardContent className="font-bold text-lg">{product.go_live_date}</CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Launch Month</CardTitle></CardHeader>
                            <CardContent className="font-bold text-lg">{product.launch_month}</CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Category</CardTitle></CardHeader>
                            <CardContent className="font-bold text-lg">
                                {product.category}
                                {product.sub_category && <span className="block text-sm font-normal text-muted-foreground">{product.sub_category}</span>}
                            </CardContent>
                        </Card>
                        {/* GP Card Hidden for CS/AfterService */}
                        <FinancialCards product={product} />
                    </div>

                    {/* Cost/Price Details Hidden for CS/AfterService */}
                    <CostPriceCard product={product} />

                    {/* Product Specific Details from Checklist */}
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Product Specifics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {tasks.filter(t => t.phase === 'Product Detail' || t.task_code.startsWith('DET')).length > 0 ? (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {tasks.filter(t => t.phase === 'Product Detail' || t.task_code.startsWith('DET')).map(t => (
                                        <div key={t.product_task_id} className="border p-3 rounded-md">
                                            <div className="font-semibold text-sm text-muted-foreground">{t.task_name}</div>
                                            <div className="mt-1 whitespace-pre-wrap font-medium">{t.notes || <span className="text-muted-foreground font-normal italic">Pending input...</span>}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">No product details defined yet.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="checklist">
                    <Card>
                        <CardHeader><CardTitle>Workflow Checklist</CardTitle></CardHeader>
                        <CardContent>
                            <ChecklistTable tasks={tasks} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="kanban">
                    <KanbanBoard tasks={tasks} />
                </TabsContent>

                <TabsContent value="gantt">
                    <GanttChart tasks={tasks} />
                </TabsContent>

                <TabsContent value="files">
                    <Card>
                        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
                        <CardContent>
                            <AttachmentsList productId={product.product_id} attachments={attachments} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
