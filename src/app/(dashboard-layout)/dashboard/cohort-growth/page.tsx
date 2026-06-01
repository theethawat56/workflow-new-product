import { CohortGrowthDashboard } from "@/components/dashboard/cohort-growth-dashboard"
import { findAll } from "@/lib/db/adapter"
import { SheetName } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export default async function CohortGrowthPage() {
    const [salesOrders, launchedProducts, products, poCosts] = await Promise.all([
        findAll<any>("sales_orders" as SheetName).catch(() => [] as any[]),
        findAll<any>("launched_products" as SheetName),
        findAll<any>("products" as SheetName),
        findAll<any>("po_costs" as SheetName).catch(() => [] as any[]),
    ])

    return (
        <CohortGrowthDashboard
            salesOrders={salesOrders}
            launchedProducts={launchedProducts}
            products={products}
            poCosts={poCosts}
        />
    )
}
