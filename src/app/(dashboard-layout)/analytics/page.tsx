import { loadAnalyticsData } from "@/lib/analytics/data"
import { OverviewDashboard } from "@/components/analytics/OverviewDashboard"

export const dynamic = "force-dynamic"

export default async function AnalyticsOverviewPage() {
    const data = await loadAnalyticsData()
    return <OverviewDashboard data={data} />
}
