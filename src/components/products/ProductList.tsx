"use client"

import React, { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { updateProductStatusAction } from "@/app/actions/product"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Loader2, Rocket, RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { isNewLaunchProduct } from "@/lib/sales/cohort"

type SortField = "name" | "launch_date" | null
type SortDir = "asc" | "desc"

interface Product {
    product_id: string
    sku_code: string
    product_name: string
    category: string
    launch_month: string
    go_live_date: string
    sales_channel: string
    status: string
    product_image_url?: string
    active_task?: string
    active_task_due_date?: string
}

interface LaunchedProductRef {
    zort_sku: string
    launch_type?: string
}

interface ProductListProps {
    initialProducts: Product[]
    isLaunchedView?: boolean
    launchedProducts?: LaunchedProductRef[]
}

export function ProductList({
    initialProducts,
    isLaunchedView = false,
    launchedProducts = [],
}: ProductListProps) {
    const router = useRouter()
    const currentYear = new Date().getFullYear()

    const launchedMap = useMemo(() => {
        const map = new Map<string, LaunchedProductRef>()
        launchedProducts.forEach((lp) => {
            const sku = String(lp.zort_sku ?? "").trim()
            if (sku) map.set(sku, lp)
        })
        return map
    }, [launchedProducts])

    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [channelFilter, setChannelFilter] = useState("ALL")
    const [launchFilter, setLaunchFilter] = useState("ALL") // ALL | NEW | CATALOG

    // Sort state
    const [sortField, setSortField] = useState<SortField>(null)
    const [sortDir, setSortDir] = useState<SortDir>("asc")

    // Expanded rows (drill-down)
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

    const toggleExpand = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === "asc" ? "desc" : "asc")
        } else {
            setSortField(field)
            setSortDir("asc")
        }
    }

    // Launch Modal State
    const [launchOpen, setLaunchOpen] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [zortSku, setZortSku] = useState("")
    const [isLaunching, setIsLaunching] = useState(false)

    // Unlaunch State
    const [unlaunchOpen, setUnlaunchOpen] = useState(false)
    const [isUnlaunching, setIsUnlaunching] = useState(false)
    const [unlaunchTarget, setUnlaunchTarget] = useState<Product | null>(null)


    const handleLaunchClick = (product: Product) => {
        setSelectedProduct(product)
        setZortSku(product.sku_code) // Default to internal SKU
        setLaunchOpen(true)
    }

    const onUnlaunchClick = (product: Product) => {
        setUnlaunchTarget(product)
        setUnlaunchOpen(true)
    }

    const confirmUnlaunch = async () => {
        if (!unlaunchTarget) return

        setIsUnlaunching(true)
        try {
            const res = await fetch("/api/products/unlaunch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: unlaunchTarget.product_id,
                    sku_code: unlaunchTarget.sku_code,
                    product_name: unlaunchTarget.product_name
                })
            })

            if (!res.ok) {
                const err = await res.json()
                alert(err.error || "Un-launch failed")
                return
            }

            setUnlaunchOpen(false)
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("An error occurred")
        } finally {
            setIsUnlaunching(false)
        }
    }

    const confirmLaunch = async () => {
        if (!selectedProduct || !zortSku) return

        setIsLaunching(true)
        try {
            // 1. Call Launch API
            const res = await fetch("/api/products/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: selectedProduct.product_id,
                    zort_sku: zortSku,
                    product_name: selectedProduct.product_name
                })
            })

            if (!res.ok) {
                const err = await res.json()
                alert(err.error || "Launch failed")
                return
            }

            // 2. Update status to Launched
            await updateProductStatusAction(selectedProduct.product_id, "Launched")

            setLaunchOpen(false)
            alert("Product Launched Successfully!")
            router.push("/products/on-sale")
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("An error occurred")
        } finally {
            setIsLaunching(false)
        }
    }

    const filtered = useMemo(() => {
        const results = initialProducts.filter(p => {
            const matchesSearch =
                p.product_name.toLowerCase().includes(search.toLowerCase()) ||
                p.sku_code.toLowerCase().includes(search.toLowerCase())

            const matchesStatus = statusFilter === "ALL" || p.status === statusFilter
            const matchesChannel = channelFilter === "ALL" || p.sales_channel === channelFilter

            // New vs catalog — same rule as Sales dashboard
            let matchesLaunch = true
            if (isLaunchedView && launchFilter !== "ALL") {
                const isNew = isNewLaunchProduct(
                    p.go_live_date,
                    launchedMap.get(p.sku_code.trim()),
                    currentYear,
                )
                if (launchFilter === "NEW") matchesLaunch = isNew
                else if (launchFilter === "CATALOG") matchesLaunch = !isNew
            }

            return matchesSearch && matchesStatus && matchesChannel && matchesLaunch
        })

        // Apply sort
        if (sortField) {
            results.sort((a, b) => {
                let valA: string | number = ""
                let valB: string | number = ""
                if (sortField === "name") {
                    valA = a.product_name?.toLowerCase() ?? ""
                    valB = b.product_name?.toLowerCase() ?? ""
                } else if (sortField === "launch_date") {
                    valA = a.go_live_date ? new Date(a.go_live_date).getTime() : 0
                    valB = b.go_live_date ? new Date(b.go_live_date).getTime() : 0
                }
                if (valA < valB) return sortDir === "asc" ? -1 : 1
                if (valA > valB) return sortDir === "asc" ? 1 : -1
                return 0
            })
        }

        return results
    }, [initialProducts, search, statusFilter, channelFilter, launchFilter, isLaunchedView, currentYear, sortField, sortDir, launchedMap])


    // Get unique channels for filter
    const channels = Array.from(new Set(initialProducts.map(p => p.sales_channel).filter(Boolean)))

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center flex-wrap">
                <Input
                    placeholder="Search SKU or Name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-[200px]"
                />

                {/* Launch Filter (Only on On-Sale Page) */}
                {isLaunchedView && (
                    <div className="flex items-center space-x-1 border rounded-md p-1 bg-muted/20">
                        <Button
                            variant={launchFilter === "ALL" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setLaunchFilter("ALL")}
                            className="h-7 text-xs"
                        >
                            All
                        </Button>
                        <Button
                            variant={launchFilter === "NEW" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setLaunchFilter("NEW")}
                            className="h-7 text-xs text-green-700"
                        >
                            New ({currentYear})
                        </Button>
                        <Button
                            variant={launchFilter === "CATALOG" ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setLaunchFilter("CATALOG")}
                            className="h-7 text-xs text-muted-foreground"
                        >
                            Catalog
                        </Button>
                    </div>
                )}

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
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
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger className="w-[140px]">
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
                            {/* Expand toggle column */}
                            <TableHead className="w-[36px]"></TableHead>
                            <TableHead className="w-[52px]"></TableHead>
                            <TableHead>SKU</TableHead>
                            {/* Sortable Name */}
                            <TableHead>
                                <button
                                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                                    onClick={() => handleSort("name")}
                                >
                                    Name
                                    {sortField === "name"
                                        ? sortDir === "asc"
                                            ? <ArrowUp className="h-3 w-3" />
                                            : <ArrowDown className="h-3 w-3" />
                                        : <ArrowUpDown className="h-3 w-3 opacity-40" />
                                    }
                                </button>
                            </TableHead>
                            <TableHead>Category</TableHead>
                            {/* Sortable Launch Date */}
                            <TableHead>
                                <button
                                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                                    onClick={() => handleSort("launch_date")}
                                >
                                    Launch Date
                                    {sortField === "launch_date"
                                        ? sortDir === "asc"
                                            ? <ArrowUp className="h-3 w-3" />
                                            : <ArrowDown className="h-3 w-3" />
                                        : <ArrowUpDown className="h-3 w-3 opacity-40" />
                                    }
                                </button>
                            </TableHead>
                            <TableHead>Active Task</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center h-24">
                                    No results.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map(product => {
                                const launchDate = product.go_live_date ? new Date(product.go_live_date) : null
                                const launchYear = launchDate ? launchDate.getFullYear() : null
                                const isNew = isNewLaunchProduct(
                                    product.go_live_date,
                                    launchedMap.get(product.sku_code.trim()),
                                    currentYear,
                                )
                                const isExpanded = expandedRows.has(product.product_id)

                                return (
                                    <React.Fragment key={product.product_id}>
                                        <TableRow key={product.product_id} className={cn(isExpanded && "border-b-0")}>
                                            {/* Expand chevron */}
                                            <TableCell className="pr-0 pl-2">
                                                <button
                                                    onClick={() => toggleExpand(product.product_id)}
                                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                                    aria-label={isExpanded ? "Collapse" : "Expand"}
                                                >
                                                    {isExpanded
                                                        ? <ChevronDown className="h-4 w-4" />
                                                        : <ChevronRight className="h-4 w-4" />
                                                    }
                                                </button>
                                            </TableCell>
                                            {/* Thumbnail */}
                                            <TableCell className="pr-0">
                                                {product.product_image_url ? (
                                                    <img
                                                        src={product.product_image_url}
                                                        alt={product.product_name}
                                                        className="w-10 h-10 rounded-md object-cover border bg-muted/30 shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-md border bg-muted/40 flex items-center justify-center shrink-0">
                                                        <span className="text-muted-foreground text-[10px]">No img</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {product.sku_code}
                                                {isNew && isLaunchedView && (
                                                    <Badge
                                                        variant="outline"
                                                        className="ml-2 py-0 h-5 text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200"
                                                    >
                                                        New
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>{product.product_name}</TableCell>
                                            <TableCell>{product.category}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{product.launch_month}</span>
                                                    {launchYear && launchYear !== currentYear && (
                                                        <span className="text-xs text-muted-foreground">{launchYear}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
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
                                                <Badge variant={
                                                    product.status === 'Launched' ? 'default' :
                                                        product.status === 'Active' ? 'secondary' : 'outline'
                                                }>
                                                    {product.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                {/* Launch Button (Only for Pipeline View) */}
                                                {!isLaunchedView && product.status !== 'Launched' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => handleLaunchClick(product)}
                                                    >
                                                        <Rocket className="h-3 w-3" />
                                                        Launch
                                                    </Button>
                                                )}

                                                {/* Un-Launch Button (Only for Launched View) */}
                                                {isLaunchedView && product.status === 'Launched' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => onUnlaunchClick(product)}
                                                        disabled={isUnlaunching && unlaunchTarget?.product_id === product.product_id}
                                                    >
                                                        {isUnlaunching && unlaunchTarget?.product_id === product.product_id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <RotateCcw className="h-3 w-3" />
                                                        )}
                                                        Undo
                                                    </Button>
                                                )}

                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/products/${product.product_id}`}>View</Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>

                                        {/* Drill-down row */}
                                        {isExpanded && (
                                            <TableRow key={`${product.product_id}-drill`} className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={10} className="py-3 px-6">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Sales Channel</p>
                                                            <p className="font-medium">{product.sales_channel || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Category</p>
                                                            <p className="font-medium">{product.category || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Go-Live Date</p>
                                                            <p className="font-medium">{product.go_live_date || '—'}</p>
                                                        </div>
                                                        <div className="flex items-end">
                                                            <Button size="sm" variant="outline" asChild>
                                                                <Link href={`/products/${product.product_id}`}>View Full Details →</Link>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Launch Dialog */}
            <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Launch Product</DialogTitle>
                        <DialogDescription>
                            Enter the Zortout SKU for reporting tracking.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Product
                            </Label>
                            <Input
                                id="name"
                                value={selectedProduct?.product_name || ''}
                                disabled
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="zortSku" className="text-right">
                                Zort SKU
                            </Label>
                            <Input
                                id="zortSku"
                                value={zortSku}
                                onChange={(e) => setZortSku(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. ATB-001"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLaunchOpen(false)}>Cancel</Button>
                        <Button onClick={confirmLaunch} disabled={!zortSku || isLaunching}>
                            {isLaunching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Launch
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Unlaunch Confirm Dialog */}
            <Dialog open={unlaunchOpen} onOpenChange={setUnlaunchOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Undo Launch</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to un-launch this product?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <p className="text-sm text-muted-foreground">
                            This will remove <strong>{unlaunchTarget?.product_name}</strong> from the "Products on Sale" list and stop tracking its sales in the New Product dashboard.
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                            The product will return to the <strong>New Products</strong> pipeline with an <strong>Active</strong> status.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUnlaunchOpen(false)} disabled={isUnlaunching}>Cancel</Button>
                        <Button onClick={confirmUnlaunch} variant="destructive" disabled={isUnlaunching}>
                            {isUnlaunching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Undo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
