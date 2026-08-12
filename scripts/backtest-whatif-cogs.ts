/**
 * Standalone check: what-if COGS = po_costs.weighted_avg_cost only
 * (Stock_AT COGS shown for comparison; not used at runtime.)
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { google } from "googleapis"

const GROUPS: Record<string, string> = {
    ATB092116: "Nugget ICE Maker",
    ATB092105: "Snow Maker",
    ATB092115: "Jonr X9",
    ATB092123: "Smart Scale 8 Air",
    ATB092128: "Mist Fan V1.5",
    ATB092037: "Air Force Pro",
    ATB092129: "Nugget Ice Neo",
    ATB092139: "Hizero H100R",
    ATB092125: "Neakasa AirStep",
    ATB092141: "Airjet Pencil",
    ATB092121: "Meari Snap Camera",
    ATB92119: "Cooling Suit",
    ATB092127: "Mist Fan V2",
    ATB092134: "Mist Fan V2",
    ATB092135: "TriCreate",
    ATB092117: "Air Carry Luggage",
    ATB092124: "Lamp Learning desk",
    ATB092114: "Jimok J7",
    ATB092113: "Jimok J7",
    ATB092138: "JAH Smell Guard Neo",
    ATB092137: "JAH Smell Guard Pro",
    ATB092133: "Aiffro SSD",
    ATB092140: "Neakasa PooGuard",
    ATB092160: "IceBall Maker",
    ATB092159: "ร่ม Fabric Cooling",
    ATB092158: "ร่ม Fabric Cooling",
    ATB092157: "ร่ม World's thinnest",
    ATB092156: "Petpivot AutoScooper",
    ATB092155: "Cooling w/Charging",
    ATB092153: "Car Diffuser",
    ATB092152: "Car Diffuser",
    ATB092151: "Car Diffuser",
    ATB092150: "Diffuser 5800",
    ATB092149: "Diffuser 5800",
    ATB092145: "Diffuser 5800",
    ATB092146: "JONR H2",
    ATB092147: "YOKONEGU Premium",
}

function num(v: unknown) {
    if (v == null || v === "") return 0
    const n = Number(String(v).replace(/,/g, ""))
    return Number.isFinite(n) ? n : 0
}

async function readTab(sheets: any, id: string, tab: string) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: tab })
    const values = res.data.values ?? []
    if (values.length < 2) return []
    const header = values[0].map((h: string) => String(h).trim())
    return values.slice(1).map((row: string[]) =>
        Object.fromEntries(header.map((h: string, i: number) => [h, row[i] ?? ""])),
    )
}

async function main() {
    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })
    const sheets = google.sheets({ version: "v4", auth })
    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!

    const [stock, po] = await Promise.all([
        readTab(sheets, id, "Stock_AT"),
        readTab(sheets, id, "po_costs"),
    ])

    const stockCogs = new Map<string, number>()
    const stockQty = new Map<string, number>()
    for (const r of stock) {
        const sku = String(r.ATB ?? r.SKU ?? "").trim().toUpperCase()
        if (!sku) continue
        stockQty.set(sku, (stockQty.get(sku) ?? 0) + num(r["Current Stock"]))
        if (!stockCogs.has(sku) || stockCogs.get(sku) === 0) stockCogs.set(sku, num(r.COGS))
    }
    const poCogs = new Map<string, number>()
    for (const r of po) {
        const sku = String(r.sku ?? "").trim().toUpperCase()
        const c = num(r.weighted_avg_cost)
        if (sku && c > 0) poCogs.set(sku, c)
    }

    // reverse map group -> skus
    const byGroup = new Map<string, string[]>()
    for (const [sku, name] of Object.entries(GROUPS)) {
        const list = byGroup.get(name) ?? []
        list.push(sku)
        byGroup.set(name, list)
    }

    console.log("group | Stock_AT COGS (unused) | po_costs COGS (=effective) | status")
    let missingPo = 0
    let differsFromStock = 0
    for (const [name, skus] of [...byGroup.entries()].sort()) {
        const stockVals = skus.map((s) => stockCogs.get(s) ?? 0).filter((c) => c > 0)
        const poVals = skus.map((s) => poCogs.get(s) ?? 0).filter((c) => c > 0)
        const stockAvg = stockVals.length ? stockVals.reduce((a, b) => a + b, 0) / stockVals.length : 0
        const poAvg = poVals.length ? poVals.reduce((a, b) => a + b, 0) / poVals.length : 0
        const effective = poAvg // runtime: po_costs only
        const issue =
            poAvg <= 0
                ? "MISSING po_costs → Action ฿0"
                : stockAvg > 0 && Math.abs(stockAvg - poAvg) > 1
                  ? "OK po_costs (≠ Stock_AT)"
                  : "OK po_costs"
        if (poAvg <= 0) missingPo++
        if (stockAvg > 0 && Math.abs(stockAvg - poAvg) > 1) differsFromStock++
        console.log(
            `${name.padEnd(28)} stock=${stockAvg.toFixed(0).padStart(6)}  po=${poAvg.toFixed(0).padStart(6)}  eff=${effective.toFixed(0).padStart(6)}  ${issue}`,
        )
    }
    console.log(`\nMissing po_costs: ${missingPo} | Differ from Stock_AT: ${differsFromStock}`)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
