
import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { config } from "dotenv"
import path from "path"
import { SHEETS_CONFIG } from "@/lib/db/schema"

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") })

const MOCK_PLANS = [
    {
        sku: "Autobot Snow Maker", // Ensure this matches actual SKU
        launch_month_plan: "2026-01",
        expected_units_m1: 100,
        expected_units_m2: 200,
        expected_gp_m1: 50000,
        invest_total: 500000,
        price_plan: 9900,
        gp_per_unit_plan: 3000
    },
    {
        sku: "Jonr X9", // Ensure this matches actual SKU
        launch_month_plan: "2026-01",
        expected_units_m1: 50,
        expected_units_m2: 120,
        expected_gp_m1: 20000,
        invest_total: 200000,
        price_plan: 5900,
        gp_per_unit_plan: 1500
    },
    {
        sku: "Autobot x Neakasa M1",
        launch_month_plan: "2026-02",
        expected_units_m1: 30,
        expected_units_m2: 80,
        expected_gp_m1: 15000,
        invest_total: 100000,
        price_plan: 12900,
        gp_per_unit_plan: 4000
    }
]

async function seedTargetPlan() {
    console.log("Seeding target_plan sheet...")

    try {
        const sheets = await getSheetsClient()
        const spreadsheetId = await getSpreadsheetId()
        const sheetTitle = SHEETS_CONFIG.target_plan.name

        // Convert objects to array of values based on headers order
        const headers = SHEETS_CONFIG.target_plan.headers
        const values = MOCK_PLANS.map(plan => {
            return headers.map(header => {
                // @ts-ignore
                return plan[header] || ""
            })
        })

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetTitle}!A2`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: values
            }
        })

        console.log(`Seeded ${values.length} rows into target_plan.`)

    } catch (error) {
        console.error("Failed to seed target_plan:", error)
    }
}

seedTargetPlan()
