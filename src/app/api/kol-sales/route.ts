import { NextRequest, NextResponse } from "next/server"
import { getKolSalesDataV2 } from "@/features/kolSalesDashboardV2/service"
import { DashboardFilters } from "@/features/kolSalesDashboardV2/types"

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)

        // Parse Filters from Query Params
        const filters: DashboardFilters = {
            dateRange: {
                from: searchParams.get("from") || "",
                to: searchParams.get("to") || ""
            },
            selectedSkus: searchParams.get("skus")?.split(",").filter(Boolean) || [],
            selectedPics: searchParams.get("pics")?.split(",").filter(Boolean) || [],
            selectedChannels: searchParams.get("channels")?.split(",").filter(Boolean) || [],
            mode: (searchParams.get("mode") === "ATTRIBUTION") ? "ATTRIBUTION" : "PERIOD",
            attributionWindow: parseInt(searchParams.get("window") || "1")
        }

        const data = await getKolSalesDataV2(filters)
        return NextResponse.json(data)
    } catch (error) {
        console.error("V2 API Error:", error)
        return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 })
    }
}
