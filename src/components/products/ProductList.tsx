"use client"

import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { updateProductStatusAction } from "@/app/actions/product"
import { cn } from "@/lib/utils"

interface Product {
    product_id: string
    sku_code: string
    product_name: string
    category: string
    launch_month: string
    go_live_date: string
    sales_channel: string
    status: string
    active_task?: string // Added
    active_task_due_date?: string // Added
}

export function ProductList({ initialProducts }: { initialProducts: Product[] }) {
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [channelFilter, setChannelFilter] = useState("ALL")

    const filtered = useMemo(() => {
        return initialProducts.filter(p => {
            const matchesSearch =
                p.product_name.toLowerCase().includes(search.toLowerCase()) ||
                p.sku_code.toLowerCase().includes(search.toLowerCase())

            const matchesStatus = statusFilter === "ALL" || p.status === statusFilter
            const matchesChannel = channelFilter === "ALL" || p.sales_channel === channelFilter

            return matchesSearch && matchesStatus && matchesChannel
        })
    }, [initialProducts, search, statusFilter, channelFilter])

    // Get unique channels for filter
    const channels = Array.from(new Set(initialProducts.map(p => p.sales_channel).filter(Boolean)))

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
                <Input
                    placeholder="Search SKU or Name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Statuses</SelectItem>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Launched">Launched</SelectItem>
                        <SelectItem value="Hold">Hold</SelectItem>
                    </SelectContent>
                </Select>
                {/* Keep Channel Filter or remove? Keeping for utility even if column hidden? */}
                {/* User asked to "change product page on column", implying REPLACEMENT. */}
                {/* But filter might still be useful. Let's keep it. */}
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Channel" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Channels</SelectItem>
                        {channels.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="ml-auto text-sm text-muted-foreground self-center">
                    {filtered.length} products found
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Launch Month</TableHead>
                            <TableHead>Active Task</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24">
                                    No results.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map(product => (
                                <TableRow key={product.product_id}>
                                    <TableCell className="font-medium">{product.sku_code}</TableCell>
                                    <TableCell>{product.product_name}</TableCell>
                                    <TableCell>{product.category}</TableCell>
                                    <TableCell>{product.launch_month}</TableCell>
                                    <TableCell>
                                        {/* Show Active Task */}
                                        {product.active_task && product.active_task !== '-' ? (
                                            <Badge variant="secondary" className="font-normal">
                                                {product.active_task}
                                            </Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{product.active_task_due_date || '-'}</TableCell>
                                    <TableCell>
                                        <Select
                                            defaultValue={product.status}
                                            onValueChange={async (val) => {
                                                const res = await updateProductStatusAction(product.product_id, val)
                                                if (!res.success) alert("Failed to update status")
                                            }}
                                        >
                                            <SelectTrigger className={cn("w-[110px] h-8 text-xs",
                                                product.status === 'Active' ? "bg-primary text-primary-foreground hover:bg-primary/90" :
                                                    product.status === 'Launched' ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" :
                                                        "border-dashed"
                                            )}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Draft">Draft</SelectItem>
                                                <SelectItem value="Active">Active</SelectItem>
                                                <SelectItem value="Launched">Launched</SelectItem>
                                                <SelectItem value="Hold">Hold</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={`/products/${product.product_id}`}>View</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
