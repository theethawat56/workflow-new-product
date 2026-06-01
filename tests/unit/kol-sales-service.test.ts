
import { getKolSalesDataV2 as getKolSalesData } from "@/features/kolSalesDashboardV2/service"
import { DashboardFilters } from "@/features/kolSalesDashboardV2/types"

// Mock Data Source
jest.mock("@/lib/workspace/data-source", () => ({
    fetchSheet: jest.fn()
}))

import { fetchSheet } from "@/lib/workspace/data-source"
const mockFetchSheet = fetchSheet as jest.Mock

const MOCK_KOL = [
    { "Post Date": "2024-01-01", "SKU": "SKU-A", "Budget type": "CASH", "Budget amount": "1000", "Channel": "TikTok", "PIC": "Alice", "KOL Name": "KOL1", "Viewed": "100" },
    { "Post Date": "2024-01-05", "SKU": "SKU-A", "Budget type": "PRODUCT_BARTER", "Budget amount": "0", "Channel": "IG", "PIC": "Bob", "KOL Name": "KOL2" },
    { "Post Date": "2024-01-10", "SKU": "SKU-B", "Budget type": "CASH", "Budget amount": "5000", "Channel": "YouTube" }
]

const MOCK_SALES = [
    { "Date": "2024-01-02", "SKU": "SKU-A", "Revenue": "2000", "Units Sold": "2" }, // Matches KOL1 (diff 1 day)
    { "Date": "2024-01-06", "SKU": "SKU-A", "Revenue": "3000", "Units Sold": "3" }, // Matches KOL2 (diff 1 day), KOL1 (diff 5 days - depends on window)
    { "Date": "2024-01-15", "SKU": "SKU-B", "Revenue": "10000", "Units Sold": "10" } // Matches KOL3? (diff 5 days)
]

describe("KOL Sales Service", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockFetchSheet.mockImplementation((sheet) => {
            if (sheet === "kol") return Promise.resolve(MOCK_KOL)
            if (sheet === "sales_all") return Promise.resolve(MOCK_SALES)
            return Promise.resolve([])
        })
    })

    const baseFilters: DashboardFilters = {
        dateRange: { from: "2024-01-01", to: "2024-01-31" },
        selectedSkus: [],
        selectedPics: [],
        selectedChannels: [],
        mode: "ATTRIBUTION",
        attributionWindow: 7 // 7 days window
    }

    it("should calculate KPI correctly", async () => {
        const data = await getKolSalesData(baseFilters)

        expect(data.kpis.totalRevenue).toBe(15000) // 2000 + 3000 + 10000
        expect(data.kpis.totalBudget).toBe(6000) // 1000 + 0 + 5000
        expect(data.kpis.totalPosts).toBe(3)
        // Check attribution
        // Sale 1 (Jan 2): Matches KOL1 (Jan 1) -> Diff 1. Attribution: 2000
        // Sale 2 (Jan 6): Matches KOL2 (Jan 5) -> Diff 1. Also KOL1 (Jan 1) -> Diff 5.
        //    Both within 7 days window. Split 3000 -> 1500 each.
        // Sale 3 (Jan 15): Matches KOL3 (Jan 10) -> Diff 5. Attribution: 10000

        // Total Attributed = 2000 + 3000 + 10000 = 15000
        expect(data.kpis.attributedRevenue).toBe(15000)
    })

    it("should handle tight attribution window", async () => {
        const filters = { ...baseFilters, attributionWindow: 1 }
        const data = await getKolSalesData(filters)

        // Sale 1 (Jan 2): Matches KOL1 (Jan 1) -> Diff 1. OK. (2000)
        // Sale 2 (Jan 6): Matches KOL2 (Jan 5) -> Diff 1. OK. KOL1 (Jan 1) -> Diff 5 (Excludes).
        //    So KOL2 gets full 3000.
        // Sale 3 (Jan 15): Matches KOL3 (Jan 10) -> Diff 5 (Excludes).
        //    No attribution.

        // Total Attr = 2000 + 3000 = 5000
        expect(data.kpis.attributedRevenue).toBe(5000)
    })

    it("should support FULL attribution model", async () => {
        const filters = { ...baseFilters, mode: "PERIOD" as const }
        // Default window 7 days
        const data = await getKolSalesData(filters)

        // Sale 1 (2000): Matches KOL1. KOL1 += 2000.
        // Sale 2 (3000): Matches KOL1 & KOL2. KOL1 += 3000, KOL2 += 3000.
        // Sale 3 (10000): Matches KOL3. KOL3 += 10000.

        // Total Attr on posts:
        // KOL1: 2000 + 3000 = 5000
        // KOL2: 3000
        // KOL3: 10000
        // Total = 18000

        // Wait, the aggregated `attributedRevenue` in KPI might sum up post attributions?
        // My implementation: `totalAttributedRevenue += revenueShare`
        // In FULL, revenueShare = sale.revenue.
        // So for Sale 2, we add 3000 * 2 = 6000 to total?
        // Let's check implementation.
        // Yes: `eligiblePosts.forEach(...)` adds to logic.

        expect(data.kpi.attributedRevenue).toBe(18000)
        // Coverage > 100% expected
        expect(data.kpi.coveragePercent).toBeGreaterThan(100)
    })

    it("should filter by SKU", async () => {
        const filters = { ...baseFilters, selectedSkus: ["SKU-A"] }
        const data = await getKolSalesData(filters)

        expect(data.kpi.totalRevenue).toBe(5000) // Only SKU-A sales
        expect(data.kpi.totalBudget).toBe(1000) // Only KOL1, KOL2 (SKU-A)
        expect(data.kpi.totalKolPosts).toBe(2)
    })
})
