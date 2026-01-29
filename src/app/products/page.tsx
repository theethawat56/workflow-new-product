import { findAll } from "@/lib/db/adapter"
import { ProductList } from "@/components/products/ProductList"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Force dynamic
export const dynamic = 'force-dynamic'

interface ProductTask {
    product_id: string
    task_name: string
    status: string
    due_date?: string
}

export default async function ProductsPage() {
    const products = await findAll<any>("products")
    const tasks = await findAll<ProductTask>("product_tasks")

    // Enhance products with active task
    const productsWithActiveTask = products.map(p => {
        // Find first task that is In Progress
        // We really should sort by something, but for now we take the first found in the list which usually follows creation order/id order.
        const activeTask = tasks.find(t => t.product_id === p.product_id && t.status === 'InProgress')
        return {
            ...p,
            active_task: activeTask ? activeTask.task_name : '-',
            active_task_due_date: activeTask ? activeTask.due_date : '-'
        }
    })

    return (
        <div className="container mx-auto py-10">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Products</h1>
                <Button asChild>
                    <Link href="/products/new">New Product</Link>
                </Button>
            </div>

            <ProductList initialProducts={productsWithActiveTask} />
        </div>
    )
}
