import { findAll } from "@/lib/db/adapter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { redirect } from "next/navigation"

// Types
import { SHEETS_CONFIG } from "@/lib/db/schema"

interface Product {
    product_id: string
    sku_code: string
    product_name: string
    go_live_date: string
    sales_channel: string
    status: string
}

export default async function DashboardPage() {
    const session = await getServerSession(authOptions)
    if (!session) {
        redirect("/api/auth/signin")
    }

    const products = await findAll<Product>("products")
    const allTasks = await findAll<any>("product_tasks")

    // Compute stats
    const totalProducts = products.length
    const activeProducts = products.filter(p => p.status === "Active").length
    const launchedProducts = products.filter(p => p.status === "Launched").length
    const draftProducts = products.filter(p => p.status === "Draft").length

    return (
        <div className="flex flex-col gap-6 p-8">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProducts}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Launches</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeProducts}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Launched</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{launchedProducts}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Drafts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{draftProducts}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Recent Products</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>SKU</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Channel</TableHead>
                                <TableHead>Go Live Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Progress</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">No products found. Initialize database or add a product.</TableCell>
                                </TableRow>
                            ) : (
                                products.slice(0, 10).map((product) => {
                                    const pTasks = allTasks.filter(t => t.product_id === product.product_id)
                                    const total = pTasks.length
                                    const done = pTasks.filter(t => t.status === "Done").length
                                    const progress = total > 0 ? Math.round((done / total) * 100) : 0

                                    return (
                                        <TableRow key={product.product_id}>
                                            <TableCell className="font-medium text-xs">{product.sku_code}</TableCell>
                                            <TableCell className="font-medium">{product.product_name}</TableCell>
                                            <TableCell>{product.sales_channel}</TableCell>
                                            <TableCell>{product.go_live_date}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    product.status === 'Active' ? 'default' :
                                                        product.status === 'Launched' ? 'secondary' : 'outline'
                                                }>{product.status}</Badge>
                                            </TableCell>
                                            <TableCell className="w-[100px]">
                                                <div className="flex flex-col gap-1">
                                                    <div className="h-2 w-full rounded-full bg-secondary">
                                                        <div
                                                            className="h-full rounded-full bg-primary transition-all"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{progress}%</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div >
    )
}
