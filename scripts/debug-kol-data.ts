
import { config } from "dotenv"
import { getKolSalesData } from "../src/features/kolSalesDashboard/service"
import { DashboardFilters } from "../src/features/kolSalesDashboard/types"

config({ path: ".env.local" })

async function main() {
    console.log("Starting KOL Data Debug...")

    // Default filters mimicking the dashboard init
    const filters: DashboardFilters = {
        dateRange: {
            from: "2025-01-01", // Wide range
            to: "2026-12-31"
        },
        selectedSkus: [],
        selectedPics: [],
        selectedProductNames: [],
        selectedChannels: [],
        selectedBudgetTypes: [],
        attributionWindowDays: 30, // Larger window
        attributionModel: "CORRELATION" // Test new model
    }

    // Inject logic to test differenceInDays with invalid date
    const { differenceInDays, parseISO } = require("date-fns")
    try {
        console.log("Testing specific failure case...")
        differenceInDays(new Date(), parseISO("2023-13-01"))
    } catch (e) {
        console.log("CONFIRMED: differenceInDays throws on invalid ISO date:", e.message)
    }

    try {
        console.log("Fetching data with filters:", filters)
        const data = await getKolSalesData(filters)
        console.log("Data processing successful!")
        console.log("KPI:", data.kpi)
        console.log("TimeSeries length:", data.timeSeries.length)
    } catch (error) {
        console.error("FATAL ERROR during data processing:")
        console.error(error)
        if (error instanceof Error) {
            console.error("Stack:", error.stack)
        }
    }
}

main()
