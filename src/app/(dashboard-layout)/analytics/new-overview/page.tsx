import { loadLaunchCommandCenter } from "@/lib/analytics/launch-command-center"
import { LaunchCommandCenterDashboard } from "@/components/analytics/LaunchCommandCenterDashboard"

export const dynamic = "force-dynamic"

export default async function NewProductOverviewPage({
    searchParams,
}: {
    searchParams: Promise<{ group?: string }>
}) {
    const { group } = await searchParams
    const data = await loadLaunchCommandCenter(group)
    return <LaunchCommandCenterDashboard data={data} />
}
