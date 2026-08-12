/**
 * Backtest "จริง ส.ค." column: raw MTD vs UI partial-month ×30/day.
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

async function main() {
    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })
    const sheets = google.sheets({ version: "v4", auth })
    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID!
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "sales_orders" })
    const values = res.data.values ?? []
    const header = values[0].map((h: string) => String(h).trim())
    const rows = values.slice(1).map((row: string[]) =>
        Object.fromEntries(header.map((h: string, i: number) => [h, row[i] ?? ""])),
    )

    const skuToGroup = new Map(Object.entries(GROUPS).map(([s, g]) => [s.toUpperCase(), g]))
    let last = ""
    const byGroupMonth = new Map<string, number>()
    const byGroupDay = new Map<string, Map<string, number>>()
    for (const r of rows) {
        if (String(r.status ?? "") !== "Success") continue
        if (num(r.line_total_pretax) <= 0) continue
        const ch = String(r.channel_raw ?? "").trim()
        if (EXCLUDED.has(ch)) continue
        const sku = String(r.sku ?? "").trim().toUpperCase()
        const group = skuToGroup.get(sku)
        if (!group) continue
        const date = String(r.order_date ?? "").slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        if (date > last) last = date
        if (!date.startsWith("2026-08")) continue
        const q = num(r.quantity)
        byGroupMonth.set(group, (byGroupMonth.get(group) ?? 0) + q)
        if (!byGroupDay.has(group)) byGroupDay.set(group, new Map())
        const d = byGroupDay.get(group)!
        d.set(date, (d.get(date) ?? 0) + q)
    }

    const lastDay = parseInt(last.slice(8, 10), 10) || 1
    const dim = new Date(2026, 8, 0).getDate()
    const pf = lastDay < dim ? 30 / lastDay : 1
    console.log(
        JSON.stringify(
            {
                last,
                lastDay,
                daysInMonth: dim,
                partialFactor: pf,
                bug:
                    pf > 5
                        ? "BUG: early-month ×30/day inflates จริง column — should show raw MTD"
                        : "partial factor mild",
            },
            null,
            2,
        ),
    )

    const names = [...byGroupMonth.keys()].sort(
        (a, b) => (byGroupMonth.get(b) ?? 0) - (byGroupMonth.get(a) ?? 0),
    )
    for (const n of names) {
        const raw = byGroupMonth.get(n)!
        const adj = raw * pf
        const days = Object.fromEntries([...(byGroupDay.get(n)?.entries() ?? [])].sort())
        console.log(
            `${n.padEnd(24)} rawMTD=${String(raw).padStart(4)}  UI_adj=${String(Math.round(adj)).padStart(5)}  days=${JSON.stringify(days)}`,
        )
    }
    console.log("groups with Aug sales:", names.length)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
