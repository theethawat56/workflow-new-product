import { DashboardContainer } from "@/features/kolSalesDashboardV2/components/DashboardContainer"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "KOL Sales Analytics",
    description: "Analyze KOL performance and sales attribution"
}

export default function KolSalesPage() {
    return <DashboardContainer />
}
