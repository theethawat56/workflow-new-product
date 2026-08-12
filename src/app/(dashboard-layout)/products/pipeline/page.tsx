import { ProductList } from "@/components/products/ProductList"
import { findAll } from "@/lib/db/adapter"
import { SheetName } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { ProductKPICards } from "@/components/products/ProductKPICards"

export const dynamic = 'force-dynamic'

export default async function PipelineProductsPage() {
    const products = await findAll<any>("products" as SheetName)

    // Filter for non-launched products (Draft, Active, Hold), exclude Existing
    const pipelineProducts = products.filter((p: any) => p.status !== "Launched" && p.status !== "Existing")

    // --- KPI Calculations (Based on ALL products) ---
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // 1. Not Launched: Status is NOT 'Launched' and NOT 'Existing'
    const notLaunchedCount = products.filter(p => p.status !== 'Launched' && p.status !== 'Existing').length

    // 2. Launch Yearly: Status 'Launched' AND go_live_date is in current year
    const yearlyLaunchCount = products.filter(p => {
        if (p.status !== 'Launched') return false
        if (!p.go_live_date) return false
        const d = new Date(p.go_live_date)
        return !isNaN(d.getTime()) && d.getFullYear() === currentYear
    }).length

    // 3. Launch Monthly: Status 'Launched' AND go_live_date is in current month
    const monthlyLaunchCount = products.filter(p => {
        if (p.status !== 'Launched') return false
        if (!p.go_live_date) return false
        const d = new Date(p.go_live_date)
        return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear
    }).length

    // 4. Avg Time Process
    let totalDays = 0
    let launchCountForAvg = 0

    products.forEach(p => {
        if (p.status === 'Launched' && p.created_at && p.go_live_date) {
            const start = new Date(p.created_at)
            const end = new Date(p.go_live_date)
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                const diffTime = Math.abs(end.getTime() - start.getTime())
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                totalDays += diffDays
                launchCountForAvg++
            }
        }
    })

    const avgLaunchTimeDays = launchCountForAvg > 0 ? Math.round(totalDays / launchCountForAvg) : 0

    return (
        <div className="flex flex-col gap-4 w-full py-2 text-foreground">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">New Products</h1>
                    <p className="text-muted-foreground mt-1">Manage new product pipeline (Draft, Active, Hold)</p>
                </div>
                <Button asChild>
                    <Link href="/products/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Product
                    </Link>
                </Button>
            </div>

            <ProductKPICards
                notLaunchedCount={notLaunchedCount}
                yearlyLaunchCount={yearlyLaunchCount}
                monthlyLaunchCount={monthlyLaunchCount}
                avgLaunchTimeDays={avgLaunchTimeDays}
            />

            <ProductList initialProducts={pipelineProducts} isLaunchedView={false} />
        </div>
    )
}
