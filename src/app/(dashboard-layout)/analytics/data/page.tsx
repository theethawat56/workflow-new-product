import { loadJoinedRows } from "@/lib/analytics/data"
import { DataExplorer } from "@/components/analytics/DataExplorer"
import type { Cohort } from "@/lib/analytics/types"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 100

export default async function AnalyticsDataPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | undefined>>
}) {
    const params = await searchParams
    const page = Math.max(1, Number(params.page ?? 1))
    const offset = (page - 1) * PAGE_SIZE

    const { rows, total } = await loadJoinedRows({
        cohort: (params.cohort as Cohort | "ALL") ?? "ALL",
        channel: params.channel ?? "ALL",
        status: params.status ?? "ALL",
        skuSearch: params.sku,
        dateFrom: params.from,
        dateTo: params.to,
        offset,
        limit: PAGE_SIZE,
    })

    return (
        <DataExplorer rows={rows} total={total} page={page} pageSize={PAGE_SIZE} />
    )
}
