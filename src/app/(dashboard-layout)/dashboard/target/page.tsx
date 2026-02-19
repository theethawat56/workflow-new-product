import { TargetDashboard } from "@/components/dashboard/TargetDashboard"
import { fetchSheet } from "@/lib/workspace/data-source"

export const dynamic = 'force-dynamic'

export default async function TargetDashboardPage() {
    // Fetch Data
    // We fetch Sale_All for revenue/units data
    // We fetch products for COGS/Status info
    const [salesData, productsData] = await Promise.all([
        fetchSheet("sales_all"),
        fetchSheet("products")
    ])

    return <TargetDashboard salesData={salesData} productsData={productsData} />
}
