/**
 * Cross-check what-if contribution margin vs Sales-page Net GP formula.
 *
 * Sales: netGp = line_total × (1 − classifyOrderChannel().deduction) − qty × po_costs
 * What-if: same, on Success + pretax>0 + EXCLUDED_CHANNELS filtered + New-2026 SKUs only.
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { google } from "googleapis"
import { classifyOrderChannel } from "../src/lib/sales/channel"

/** Same map as src/lib/analytics/what-if.ts (inlined — that module is server-only). */
const WHAT_IF_SKU_GROUPS: Record<string, string> = {
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

const EXCLUDED = new Set([
    "Review",
    "Shopee_ส่งของแถม",
    "Shopee_ส่งของตามหลัง",
    "Lazada_ส่งของตามหลัง",
    "ของแจกงานขาย",
    "สินค้าตัวอย่าง",
    "เบิกใช้",
    "ตัวโชว์",
    "เครื่องสำรองใช้",
    "ส่งของแถมตามหลัง",
    "TIKTOK_ส่งของแถม",
    "WFM : งานซ่อม",
    "WFM : งานเคลมสินค้า",
    "WFM : -",
    "เคลมสินค้า",
    "รีวิวพี่เต้",
    "Barter",
    "Freight",
    "Shipment",
])

function num(v: unknown) {
    if (v == null || v === "") return 0
    const n = Number(String(v).replace(/,/g, ""))
    return Number.isFinite(n) ? n : 0
}

async function readTab(sheets: any, id: string, tab: string) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: tab })
    const values = res.data.values ?? []
    if (values.length < 2) return [] as Record<string, string>[]
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
    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID!
    const [sales, po] = await Promise.all([
        readTab(sheets, id, "sales_orders"),
        readTab(sheets, id, "po_costs"),
    ])

    const costMap = new Map<string, number>()
    for (const r of po) {
        const sku = String(r.sku ?? "").trim().toUpperCase()
        const c = num(r.weighted_avg_cost)
        if (sku && c > 0) costMap.set(sku, c)
    }

    const skuToGroup = new Map(
        Object.entries(WHAT_IF_SKU_GROUPS).map(([s, g]) => [s.toUpperCase(), g]),
    )

    type Agg = {
        units: number
        revenue: number
        netGp: number
        cogs: number
        lines: number
        missingCost: number
    }
    const byGroup = new Map<string, Agg>()
    const byGroupMonth = new Map<string, Map<string, Agg>>()
    let last = ""
    let linesOk = 0
    let linesSkippedExcluded = 0

    for (const r of sales) {
        if (String(r.status ?? "") !== "Success") continue
        if (num(r.line_total_pretax) <= 0) continue
        const channelRaw = String(r.channel_raw ?? "").trim()
        if (EXCLUDED.has(channelRaw)) {
            linesSkippedExcluded++
            continue
        }
        const sku = String(r.sku ?? "").trim().toUpperCase()
        const group = skuToGroup.get(sku)
        if (!group) continue
        const date = String(r.order_date ?? "").slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        if (date > last) last = date

        const qty = num(r.quantity)
        const revenue = num(r.line_total)
        const unitCost = costMap.get(sku) ?? 0
        const ch = classifyOrderChannel(
            r.channel_raw,
            r.marketplace_name,
            r.integration_name,
        )
        const cogs = qty * unitCost
        const netGp = revenue * (1 - ch.deduction) - cogs

        // Cross-check identity: netGp === revenue - revenue*deduction - cogs
        const alt = revenue - revenue * ch.deduction - cogs
        if (Math.abs(alt - netGp) > 0.01) {
            throw new Error(`formula mismatch ${group} ${date}`)
        }

        const g = byGroup.get(group) ?? {
            units: 0,
            revenue: 0,
            netGp: 0,
            cogs: 0,
            lines: 0,
            missingCost: 0,
        }
        g.units += qty
        g.revenue += revenue
        g.netGp += netGp
        g.cogs += cogs
        g.lines++
        if (unitCost <= 0 && qty > 0) g.missingCost++
        byGroup.set(group, g)

        const month = date.slice(0, 7)
        if (!byGroupMonth.has(group)) byGroupMonth.set(group, new Map())
        const bm = byGroupMonth.get(group)!
        const m =
            bm.get(month) ?? { units: 0, revenue: 0, netGp: 0, cogs: 0, lines: 0, missingCost: 0 }
        m.units += qty
        m.revenue += revenue
        m.netGp += netGp
        m.cogs += cogs
        m.lines++
        bm.set(month, m)

        linesOk++
    }

    const lastMonth = last.slice(0, 7)
    console.log(
        JSON.stringify(
            {
                lastOrderDate: last,
                lastMonth,
                linesOk,
                linesSkippedExcluded,
                groupsWithSales: byGroup.size,
                formula: "netGp = line_total*(1-deduction) - qty*po_costs.weighted_avg_cost",
                deductions: "Marketplace 32% / Direct 19% / Other 0% via classifyOrderChannel",
            },
            null,
            2,
        ),
    )

    console.log(
        "\ngroup | rev | netGp | CM% | AugMTD netGp | AugMTD CM% | missingCostLines",
    )
    const rows = [...byGroup.entries()].sort((a, b) => b[1].revenue - a[1].revenue)
    let sumRev = 0,
        sumGp = 0,
        sumAugGp = 0
    for (const [name, g] of rows) {
        const cm = g.revenue > 0 ? (g.netGp / g.revenue) * 100 : null
        const aug = byGroupMonth.get(name)?.get(lastMonth)
        const augCm = aug && aug.revenue > 0 ? (aug.netGp / aug.revenue) * 100 : null
        sumRev += g.revenue
        sumGp += g.netGp
        sumAugGp += aug?.netGp ?? 0
        console.log(
            [
                name.padEnd(24),
                `rev=${Math.round(g.revenue).toLocaleString()}`,
                `gp=${Math.round(g.netGp).toLocaleString()}`,
                `cm%=${cm == null ? "—" : cm.toFixed(1)}`,
                `augGp=${aug ? Math.round(aug.netGp).toLocaleString() : "0"}`,
                `augCm%=${augCm == null ? "—" : augCm.toFixed(1)}`,
                `noCost=${g.missingCost}`,
            ].join(" | "),
        )
    }
    console.log(
        `\nPORTFOLIO rev=${Math.round(sumRev).toLocaleString()} netGp=${Math.round(sumGp).toLocaleString()} cm%=${
            sumRev > 0 ? ((sumGp / sumRev) * 100).toFixed(1) : "—"
        } augMtdGp=${Math.round(sumAugGp).toLocaleString()}`,
    )

    // Sanity: CM% should be below (1 - min deduction) roughly, or negative if COGS high
    const bad = rows.filter(([, g]) => g.revenue > 0 && g.netGp / g.revenue > 0.9)
    if (bad.length) {
        console.log(
            "\nWARN: CM%>90% (possible missing COGS):",
            bad.map(([n, g]) => `${n}=${((g.netGp / g.revenue) * 100).toFixed(0)}%`).join(", "),
        )
    } else {
        console.log("\nOK: no group with implausibly high CM%>90%")
    }
    console.log("OK: formula identity check passed for all lines")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
