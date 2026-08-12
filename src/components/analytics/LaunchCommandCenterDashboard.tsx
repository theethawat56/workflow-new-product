"use client"

import type { LaunchCommandCenterData } from "@/lib/analytics/launch-types"
import { LaunchPortfolioView } from "@/components/analytics/LaunchPortfolioView"
import { LaunchProductDetailView } from "@/components/analytics/LaunchProductDetailView"

export function LaunchCommandCenterDashboard({ data }: { data: LaunchCommandCenterData }) {
    if (data.selected) {
        return <LaunchProductDetailView data={data} detail={data.selected} />
    }
    return <LaunchPortfolioView data={data} />
}
