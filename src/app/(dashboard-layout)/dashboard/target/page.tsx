import { TargetDashboard } from "@/components/dashboard/TargetDashboard"

export const dynamic = 'force-dynamic'

export default async function TargetDashboardPage() {
    // Note: New TargetDashboard component fetches data client-side via API routes
    // No need to pass salesData/productsData props anymore
    return <TargetDashboard />
}