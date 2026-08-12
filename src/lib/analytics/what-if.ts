/**
 * What-if forecast dashboard — server-only data layer.
 * Reads sales_orders / KOL / Stock_AT / po_costs (+ optional "1_Forecast ยอดขาย" tab)
 * from the Google Sheet and aggregates per product group per month.
 * COGS always comes from po_costs.weighted_avg_cost (never Stock_AT).
 */

import "server-only"
import { unstable_cache } from "next/cache"
import { google } from "googleapis"
import { classifyOrderChannel } from "@/lib/sales/channel"
import {
    stockAtCurrent,
    stockAtInTransit,
    stockAtSku,
} from "@/lib/stock/stock-at-columns"

// ─── SKU → product group (37 SKU → 30 groups; colours merged) ───────────────

export const WHAT_IF_SKU_GROUPS: Record<string, string> = {
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

/** Groups forced Gate=0 by business rule (given by user). */
const GATE_ZERO_GROUPS = new Set(["Nugget Ice Neo", "Lamp Learning desk"])

/** Channels that never count as real sales (exact list from spec). */
const EXCLUDED_CHANNELS = new Set([
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

export const FORECAST_TAB_NAME = "1_Forecast ยอดขาย"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WhatIfMonthly {
    month: string // YYYY-MM
    units: number
    revenue: number
    /** Net GP = revenue×(1−channel deduction) − qty×po_costs — same as Sales page. */
    netGp: number
}

export interface WhatIfKolMonthly {
    month: string
    posts: number
    barterPosts: number
    cashBudget: number
    views: number
}

export interface WhatIfKolPost {
    date: string // YYYY-MM-DD
    month: string // YYYY-MM
    kolName: string
    channel: string
    link: string
    budgetType: string
    budget: number
    views: number
}

export interface WhatIfGroup {
    name: string
    skus: string[]
    monthly: WhatIfMonthly[]
    kolMonthly: WhatIfKolMonthly[]
    /** Individual KOL posts for detail popup (name / channel / link). */
    kolPosts: WhatIfKolPost[]
    totalUnits: number
    totalRevenue: number
    /** Lifetime Net GP (contribution) for filtered what-if sales. */
    totalNetGp: number
    /** totalNetGp / totalRevenue × 100; null when no revenue. */
    cmPct: number | null
    /** ASP derived from actuals (revenue/units); 0 when no sales. */
    asp: number
    /** COGS from po_costs.weighted_avg_cost (avg of SKUs with a value); 0 when missing. */
    cogs: number
    currentStock: number
    inTransitStock: number
    /** Defaults for the what-if model (from forecast tab, or derived). */
    defaults: {
        base: number
        trend: number
        momentum: number
        gate: number
        type: "หน้าร้อน" | "ทั่วไป"
        /** true when values come from the forecast tab, false = auto-derived */
        fromSheet: boolean
    }
}

export interface WhatIfData {
    groups: WhatIfGroup[]
    /** Latest order date in sales_orders (YYYY-MM-DD). */
    lastOrderDate: string
    /** true when the forecast tab was found and parsed. */
    forecastTabFound: boolean
    forecastTabName: string
    loadedAt: string
}

// ─── Sheets access ───────────────────────────────────────────────────────────

function sheetsAuth() {
    return new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })
}

async function readTab(tab: string): Promise<Record<string, string>[]> {
    const spreadsheetId =
        process.env.GOOGLE_SHEETS_ID ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined")
    const sheets = google.sheets({ version: "v4", auth: sheetsAuth() })
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: tab })
    const values = res.data.values ?? []
    if (values.length < 2) return []
    const header = values[0].map((h) => String(h).trim())
    return values.slice(1).map((row) =>
        Object.fromEntries(header.map((h, i) => [h, row[i] ??  ""])),
    )
}

function num(v: unknown): number {
    if (v == null || v === "") return 0
    const n = Number(String(v).replace(/,/g, ""))
    return Number.isFinite(n) ? n : 0
}

/** KOL Post Date — ISO or M/D/YYYY. */
function parseKolDate(raw: string): string | null {
    const s = raw.trim()
    if (!s) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    const parts = s.split(/[\/\-]/)
    if (parts.length !== 3) return null
    const m = parseInt(parts[0], 10)
    const d = parseInt(parts[1], 10)
    let y = parseInt(parts[2], 10)
    if (y < 100) y += 2000
    if (m < 1 || m > 12 || d < 1 || d > 31) return null
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

// ─── Loader ──────────────────────────────────────────────────────────────────

async function fetchWhatIfDirect(): Promise<WhatIfData> {
    const [salesRaw, kolRaw, stockRaw, poCostsRaw, forecastRaw] = await Promise.all([
        readTab("sales_orders"),
        readTab("KOL"),
        readTab("Stock_AT"),
        readTab("po_costs").catch(() => [] as Record<string, string>[]),
        readTab(FORECAST_TAB_NAME).catch(() => null),
    ])

    // group scaffolding
    const groupSkus = new Map<string, string[]>()
    for (const [sku, name] of Object.entries(WHAT_IF_SKU_GROUPS)) {
        const list = groupSkus.get(name) ?? []
        list.push(sku)
        groupSkus.set(name, list)
    }
    const skuToGroup = new Map(
        Object.entries(WHAT_IF_SKU_GROUPS).map(([sku, name]) => [sku.toUpperCase(), name]),
    )

    // COGS first — needed for Net GP on each sales line (same as Sales page).
    const poCostBySku = new Map<string, number>()
    for (const r of poCostsRaw) {
        const sku = String(r.sku ?? "").trim().toUpperCase()
        const cost = num(r.weighted_avg_cost)
        if (sku && cost > 0) poCostBySku.set(sku, cost)
    }

    // ── sales actuals (+ Net GP / contribution margin) ──
    // Sales page: netGp = line_total × (1 − channel deduction) − qty × unitCost
    const monthly = new Map<
        string,
        Map<string, { units: number; revenue: number; netGp: number }>
    >()
    let lastOrderDate = ""
    for (const r of salesRaw) {
        if (String(r.status ?? "") !== "Success") continue
        if (num(r.line_total_pretax) <= 0) continue
        const channelRaw = String(r.channel_raw ?? "").trim()
        if (EXCLUDED_CHANNELS.has(channelRaw)) continue
        const sku = String(r.sku ?? "").trim().toUpperCase()
        const group = skuToGroup.get(sku)
        if (!group) continue
        const date = String(r.order_date ?? "").slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        if (date > lastOrderDate) lastOrderDate = date
        const month = date.slice(0, 7)
        const qty = num(r.quantity)
        const revenue = num(r.line_total)
        const unitCost = poCostBySku.get(sku) ?? 0
        const ch = classifyOrderChannel(
            r.channel_raw,
            r.marketplace_name,
            r.integration_name,
        )
        const netGp = revenue * (1 - ch.deduction) - qty * unitCost
        const byMonth = monthly.get(group) ?? new Map()
        const cur = byMonth.get(month) ?? { units: 0, revenue: 0, netGp: 0 }
        cur.units += qty
        cur.revenue += revenue
        cur.netGp += netGp
        byMonth.set(month, cur)
        monthly.set(group, byMonth)
    }

    // ── KOL ──
    const kol = new Map<
        string,
        Map<string, { posts: number; barterPosts: number; cashBudget: number; views: number }>
    >()
    const kolPostsByGroup = new Map<string, WhatIfKolPost[]>()
    for (const r of kolRaw) {
        const sku = String(r["SKU"] ?? "").trim().toUpperCase()
        const group = skuToGroup.get(sku)
        if (!group) continue
        const date = parseKolDate(String(r["Post Date"] ?? ""))
        if (!date) continue
        const month = date.slice(0, 7)
        const byMonth = kol.get(group) ?? new Map()
        const cur =
            byMonth.get(month) ?? { posts: 0, barterPosts: 0, cashBudget: 0, views: 0 }
        cur.posts++
        if (/barter/i.test(String(r["Budget type"] ?? ""))) cur.barterPosts++
        cur.cashBudget += num(r["Budget Final"]) || num(r["Budget amount"])
        cur.views += num(r["Viewed"])
        byMonth.set(month, cur)
        kol.set(group, byMonth)

        const posts = kolPostsByGroup.get(group) ?? []
        posts.push({
            date,
            month,
            kolName: String(r["KOL Name"] ?? r["KOL name"] ?? "").trim(),
            channel: String(r["Channel"] ?? r.channel ?? "").trim(),
            link: String(r["Link"] ?? r.link ?? "").trim(),
            budgetType: String(r["Budget type"] ?? "").trim(),
            budget: num(r["Budget Final"]) || num(r["Budget amount"]),
            views: num(r["Viewed"]),
        })
        kolPostsByGroup.set(group, posts)
    }

    // ── stock qty from Stock_AT (qty only — COGS always from po_costs) ──
    const stockBySku = new Map<string, { current: number; inTransit: number }>()
    for (const r of stockRaw) {
        const sku = stockAtSku(r)
        if (!sku) continue
        const prev = stockBySku.get(sku) ?? { current: 0, inTransit: 0 }
        prev.current += stockAtCurrent(r)
        prev.inTransit += stockAtInTransit(r)
        stockBySku.set(sku, prev)
    }

    // ── forecast tab defaults (optional) ──
    // Expected columns: sku/product + D=ประเภท E=ASP F=COGS G=Base H=Trend I=Momentum J=Gate
    const forecastByGroup = new Map<
        string,
        { base: number; trend: number; momentum: number; gate: number; type: "หน้าร้อน" | "ทั่วไป" }
    >()
    if (forecastRaw) {
        for (const r of forecastRaw) {
            const sku = String(r.sku ?? r.SKU ?? "").trim().toUpperCase()
            const group = skuToGroup.get(sku) ?? String(r.group ?? r.product ?? "").trim()
            if (!group || !groupSkus.has(group)) continue
            const typeRaw = String(r["ประเภท"] ?? r.type ?? "").trim()
            forecastByGroup.set(group, {
                base: num(r.Base ?? r.base),
                trend: num(r.Trend ?? r.trend) || 1,
                momentum: num(r.Momentum ?? r.momentum) || 1,
                gate: r.Gate != null && String(r.Gate).trim() !== "" ? num(r.Gate) : 1,
                type: typeRaw === "หน้าร้อน" ? "หน้าร้อน" : "ทั่วไป",
            })
        }
    }

    // ── assemble groups ──
    const groups: WhatIfGroup[] = [...groupSkus.entries()].map(([name, skus]) => {
        const byMonth = monthly.get(name) ?? new Map()
        const months = [...byMonth.keys()].sort()
        const monthlyRows: WhatIfMonthly[] = months.map((m) => ({
            month: m,
            units: byMonth.get(m)!.units,
            revenue: byMonth.get(m)!.revenue,
            netGp: byMonth.get(m)!.netGp,
        }))
        const totalUnits = monthlyRows.reduce((s, r) => s + r.units, 0)
        const totalRevenue = monthlyRows.reduce((s, r) => s + r.revenue, 0)
        const totalNetGp = monthlyRows.reduce((s, r) => s + r.netGp, 0)
        const cmPct = totalRevenue > 0 ? (totalNetGp / totalRevenue) * 100 : null

        const kolByMonth = kol.get(name) ?? new Map()
        const kolMonthly: WhatIfKolMonthly[] = [...kolByMonth.keys()].sort().map((m) => ({
            month: m,
            ...kolByMonth.get(m)!,
        }))
        const kolPosts = [...(kolPostsByGroup.get(name) ?? [])].sort((a, b) =>
            b.date.localeCompare(a.date),
        )

        let currentStock = 0
        let inTransitStock = 0
        const cogsVals: number[] = []
        for (const sku of skus) {
            const key = sku.toUpperCase()
            const st = stockBySku.get(key)
            if (st) {
                currentStock += st.current
                inTransitStock += st.inTransit
            }
            const cogsVal = poCostBySku.get(key) ?? 0
            if (cogsVal > 0) cogsVals.push(cogsVal)
        }
        const cogs = cogsVals.length > 0 ? cogsVals.reduce((s, v) => s + v, 0) / cogsVals.length : 0
        const asp = totalUnits > 0 ? totalRevenue / totalUnits : 0

        const sheetDefaults = forecastByGroup.get(name)
        // Auto default Base = average units of the last 2 months with sales.
        const lastTwo = monthlyRows.slice(-2)
        const autoBase =
            lastTwo.length > 0
                ? lastTwo.reduce((s, r) => s + r.units, 0) / lastTwo.length
                : 0

        return {
            name,
            skus,
            monthly: monthlyRows,
            kolMonthly,
            kolPosts,
            totalUnits,
            totalRevenue,
            totalNetGp,
            cmPct,
            asp,
            cogs,
            currentStock,
            inTransitStock,
            defaults: sheetDefaults
                ? { ...sheetDefaults, fromSheet: true }
                : {
                      base: Math.round(autoBase),
                      trend: 1,
                      momentum: 1,
                      gate: GATE_ZERO_GROUPS.has(name) ? 0 : 1,
                      type: "ทั่วไป",
                      fromSheet: false,
                  },
        }
    })

    groups.sort((a, b) => b.totalRevenue - a.totalRevenue)

    return {
        groups,
        lastOrderDate,
        forecastTabFound: forecastRaw != null,
        forecastTabName: FORECAST_TAB_NAME,
        loadedAt: new Date().toISOString(),
    }
}

const getCachedWhatIf = unstable_cache(fetchWhatIfDirect, ["what-if-data-v5"], {
    revalidate: 1800,
    tags: ["analytics-data", "what-if"],
})

export async function loadWhatIfData(): Promise<WhatIfData> {
    try {
        return await getCachedWhatIf()
    } catch {
        return await fetchWhatIfDirect()
    }
}
