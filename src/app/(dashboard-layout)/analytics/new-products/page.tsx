import { loadAnalyticsData } from "@/lib/analytics/data"
import { NewProductsDashboard } from "@/components/analytics/NewProductsDashboard"

export const dynamic = "force-dynamic"

export default async function AnalyticsNewProductsPage() {
    const data = await loadAnalyticsData()
    return <NewProductsDashboard data={data} />
}
