import { loadAnalyticsData } from "@/lib/analytics/data"
import { StockDashboard } from "@/components/analytics/StockDashboard"

export const dynamic = "force-dynamic"

export default async function AnalyticsStockPage() {
    const data = await loadAnalyticsData()
    return <StockDashboard data={data} />
}
