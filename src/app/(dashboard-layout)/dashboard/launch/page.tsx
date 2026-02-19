import { LaunchControlTower } from "@/components/dashboard/launch-control-tower"
import { findAll } from "@/lib/db/adapter"

export const dynamic = "force-dynamic"

export default async function LaunchDashboardPage() {
    // Parallel data fetching for performance
    const [products, launchedProducts, sales, plans] = await Promise.all([
        findAll<any>("products"),
        findAll<any>("launched_products"),
        findAll<any>("sale_order_items"),
        findAll<any>("target_plan")
    ])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Launch Control Tower</h2>
            </div>

            <LaunchControlTower
                products={products}
                launchedProducts={launchedProducts}
                sales={sales}
                plans={plans}
            />
        </div>
    )
}
