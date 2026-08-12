/**
 * Recommend Trend / Momentum / Gate per what-if group,
 * backtest 1-month-ahead accuracy, and predict Aug-2026 order qty.
 *
 * Usage: npx tsx scripts/backtest-whatif-params.ts
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { google } from "googleapis"
import { writeFileSync } from "fs"

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

const GATE_ZERO = new Set(["Nugget Ice Neo", "Lamp Learning desk"])
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

const SHRINK = 0.8
const SEASONAL_GENERAL = [1.0, 1.05, 1.05, 1.2, 1.25] // Aug..Dec index 0..4
const SEASONAL_SUMMER = [1.2, 1.2, 1.4, 1.8, 2.0]
const SAFETY_MONTHS = 1.5
const LEAD_DAYS = 45
const ORDER_CYCLE_MONTHS = 2.0
const FORECAST_MONTHS = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]

function num(v: unknown) {
    if (v == null || v === "") return 0
    const n = Number(String(v).replace(/,/g, ""))
    return Number.isFinite(n) ? n : 0
}

function clip(v: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, v))
}

function round(v: number, d = 2) {
    const p = 10 ** d
    return Math.round(v * p) / p
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

function monthKey(d: string): string | null {
    const s = d.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7)
    const parts = s.split(/[\/\-]/)
    if (parts.length !== 3) return null
    let y = parseInt(parts[2], 10)
    const m = parseInt(parts[0], 10)
    if (y < 100) y += 2000
    if (m < 1 || m > 12) return null
    // also try YYYY first
    if (parts[0].length === 4) {
        const yy = parseInt(parts[0], 10)
        const mm = parseInt(parts[1], 10)
        if (mm >= 1 && mm <= 12) return `${yy}-${String(mm).padStart(2, "0")}`
    }
    return `${y}-${String(m).padStart(2, "0")}`
}

function daysInMonth(ym: string) {
    const y = parseInt(ym.slice(0, 4), 10)
    const m = parseInt(ym.slice(5, 7), 10)
    return new Date(y, m, 0).getDate()
}

function forecastH(
    base: number,
    trend: number,
    momentum: number,
    gate: number,
    type: "หน้าร้อน" | "ทั่วไป",
    h: number,
) {
    if (gate === 0 || base <= 0) return 0
    const seasonal = type === "หน้าร้อน" ? SEASONAL_SUMMER[h - 1] : SEASONAL_GENERAL[h - 1]
    return (
        base *
        Math.pow(trend, Math.pow(0.5, h - 1)) *
        seasonal *
        SHRINK *
        Math.pow(momentum, Math.pow(0.6, h - 1)) *
        gate
    )
}

/** Fit params from monthly history ending before `asOfMonth` (exclusive). */
function fitParams(
    monthly: { month: string; units: number }[],
    name: string,
    asOfMonth: string,
    lastDayInAsOfPrev?: { month: string; day: number },
) {
    const hist = monthly.filter((m) => m.month < asOfMonth)
    if (GATE_ZERO.has(name)) {
        return { base: 0, trend: 1, momentum: 1, gate: 0, type: "ทั่วไป" as const, reason: "EOL gate=0" }
    }
    if (hist.length === 0) {
        return { base: 0, trend: 1, momentum: 1, gate: 1, type: "ทั่วไป" as const, reason: "no history" }
    }

    // Partial-month adjust latest history month if needed
    const rows = hist.map((r) => ({ ...r }))
    if (lastDayInAsOfPrev && rows.length) {
        const last = rows[rows.length - 1]
        if (last.month === lastDayInAsOfPrev.month && lastDayInAsOfPrev.day < daysInMonth(last.month)) {
            last.units = last.units * (30 / lastDayInAsOfPrev.day)
        }
    }

    const lastTwo = rows.slice(-2)
    const base = lastTwo.reduce((s, r) => s + r.units, 0) / lastTwo.length

    const priorTwo = rows.slice(-4, -2)
    let trend = 1
    if (priorTwo.length === 2) {
        const recent = lastTwo.reduce((s, r) => s + r.units, 0) / 2
        const prior = priorTwo.reduce((s, r) => s + r.units, 0) / 2
        if (prior > 0) trend = recent / prior
    } else if (rows.length >= 2) {
        const a = rows[rows.length - 1].units
        const b = rows[rows.length - 2].units
        if (b > 0) trend = a / b
    }
    trend = clip(trend, 0.7, 1.5)

    let momentum = 1
    if (rows.length >= 2) {
        const a = rows[rows.length - 1].units
        const b = rows[rows.length - 2].units
        if (b > 0) momentum = a / b
    }
    // soften vs raw MoM (model already applies momentum^0.6)
    momentum = clip(Math.sqrt(momentum), 0.7, 1.5)

    // Gate: no sales in last 2 months → 0; thin history → keep 1
    const recentSum = lastTwo.reduce((s, r) => s + r.units, 0)
    let gate = 1
    let reason = "active"
    if (recentSum <= 0 && rows.length >= 2) {
        gate = 0
        reason = "no sales last 2 months"
    }

    // Type: compare Apr–Jul vs Nov–Feb if available
    const byM = new Map(rows.map((r) => [r.month, r.units]))
    const summer = ["-04", "-05", "-06", "-07"]
    const winter = ["-11", "-12", "-01", "-02"]
    let sSum = 0,
        sN = 0,
        wSum = 0,
        wN = 0
    for (const [m, u] of byM) {
        const mm = m.slice(4)
        if (summer.includes(mm)) {
            sSum += u
            sN++
        }
        if (winter.includes(mm)) {
            wSum += u
            wN++
        }
    }
    let type: "หน้าร้อน" | "ทั่วไป" = "ทั่วไป"
    if (sN >= 1 && wN >= 1 && wSum / wN > 0 && sSum / sN > (wSum / wN) * 1.25) {
        type = "หน้าร้อน"
        reason += " · summer SKU"
    }

    return {
        base: Math.round(base * 10) / 10,
        trend: round(trend),
        momentum: round(momentum),
        gate,
        type,
        reason,
    }
}

async function main() {
    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })
    const sheets = google.sheets({ version: "v4", auth })
    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID
    if (!id) throw new Error("missing spreadsheet id")

    const [sales, stock, po] = await Promise.all([
        readTab(sheets, id, "sales_orders"),
        readTab(sheets, id, "Stock_AT"),
        readTab(sheets, id, "po_costs"),
    ])

    const skuToGroup = new Map(
        Object.entries(WHAT_IF_SKU_GROUPS).map(([s, g]) => [s.toUpperCase(), g]),
    )
    const groupSkus = new Map<string, string[]>()
    for (const [sku, g] of Object.entries(WHAT_IF_SKU_GROUPS)) {
        const list = groupSkus.get(g) ?? []
        list.push(sku.toUpperCase())
        groupSkus.set(g, list)
    }

    // monthly units/revenue
    const monthly = new Map<string, Map<string, { units: number; revenue: number }>>()
    let lastOrderDate = ""
    for (const r of sales) {
        if (String(r.status ?? "") !== "Success") continue
        if (num(r.line_total_pretax) <= 0) continue
        const ch = String(r.channel_raw ?? "").trim()
        if (EXCLUDED.has(ch)) continue
        const sku = String(r.sku ?? "").trim().toUpperCase()
        const group = skuToGroup.get(sku)
        if (!group) continue
        const date = String(r.order_date ?? "").slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        const ym = date.slice(0, 7)
        if (date > lastOrderDate) lastOrderDate = date
        const units = num(r.quantity)
        const revenue = num(r.line_total)
        if (!monthly.has(group)) monthly.set(group, new Map())
        const byM = monthly.get(group)!
        const cur = byM.get(ym) ?? { units: 0, revenue: 0 }
        cur.units += units
        cur.revenue += revenue
        byM.set(ym, cur)
    }

    const stockBySku = new Map<string, { current: number; inTransit: number }>()
    for (const r of stock) {
        const sku = String(r.ATB ?? r.SKU ?? "").trim().toUpperCase()
        if (!sku) continue
        const prev = stockBySku.get(sku) ?? { current: 0, inTransit: 0 }
        prev.current += num(r["Current Stock"])
        prev.inTransit += num(r["In-Transit Stock"])
        stockBySku.set(sku, prev)
    }
    const poCost = new Map<string, number>()
    for (const r of po) {
        const sku = String(r.sku ?? "").trim().toUpperCase()
        const c = num(r.weighted_avg_cost)
        if (sku && c > 0) poCost.set(sku, c)
    }

    const lastMonth = lastOrderDate.slice(0, 7)
    const lastDay = parseInt(lastOrderDate.slice(8, 10), 10) || 30
    const partial = lastDay < daysInMonth(lastMonth)

    // ── Backtest: walk-forward 1-month ahead ──
    const allMonths = new Set<string>()
    for (const byM of monthly.values()) for (const m of byM.keys()) allMonths.add(m)
    const monthsSorted = [...allMonths].sort()
    // Hold-out months with enough prior history (need ≥2 months before)
    const testMonths = monthsSorted.filter((m) => {
        const idx = monthsSorted.indexOf(m)
        return idx >= 2 && m <= lastMonth
    })

    type BtRow = {
        group: string
        month: string
        actual: number
        forecast: number
        absErr: number
        trend: number
        momentum: number
        gate: number
    }
    const btRows: BtRow[] = []
    const naiveRows: { actual: number; forecast: number }[] = []

    for (const group of groupSkus.keys()) {
        const byM = monthly.get(group) ?? new Map()
        const series = [...byM.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, v]) => ({ month, units: v.units }))

        for (const tm of testMonths) {
            // skip incomplete current month as actual target (or scale)
            let actual = byM.get(tm)?.units ?? 0
            if (tm === lastMonth && partial) {
                actual = actual * (30 / lastDay) // evaluate on run-rate basis
            }
            const fitted = fitParams(series, group, tm)
            // h=1 relative to "next month after fit" — seasonal index by calendar month
            const mm = parseInt(tm.slice(5, 7), 10)
            // Map calendar month to Aug-Dec seasonal slot if in that range; else use general index 0
            let h = 1
            let seasonalOverride: number | null = null
            if (mm >= 8 && mm <= 12) {
                h = mm - 7
            } else {
                // for Jan–Jul backtest use seasonal≈1.0 (general) without Aug bias
                seasonalOverride = 1.0
            }
            let fc: number
            if (fitted.gate === 0) fc = 0
            else if (seasonalOverride != null) {
                fc =
                    fitted.base *
                    fitted.trend *
                    seasonalOverride *
                    SHRINK *
                    fitted.momentum *
                    fitted.gate
            } else {
                fc = forecastH(fitted.base, fitted.trend, fitted.momentum, fitted.gate, fitted.type, h)
            }
            // naive: last month actual (or avg last 2)
            const hist = series.filter((s) => s.month < tm)
            const naive =
                hist.length >= 2
                    ? (hist[hist.length - 1].units + hist[hist.length - 2].units) / 2
                    : hist.length
                      ? hist[hist.length - 1].units
                      : 0

            if (actual > 0 || fc > 0) {
                btRows.push({
                    group,
                    month: tm,
                    actual,
                    forecast: fc,
                    absErr: Math.abs(actual - fc),
                    trend: fitted.trend,
                    momentum: fitted.momentum,
                    gate: fitted.gate,
                })
                naiveRows.push({ actual, forecast: naive })
            }
        }
    }

    function wape(rows: { actual: number; forecast: number }[]) {
        const den = rows.reduce((s, r) => s + r.actual, 0)
        const num_ = rows.reduce((s, r) => s + Math.abs(r.actual - r.forecast), 0)
        return den > 0 ? 1 - num_ / den : null
    }
    function mape(rows: { actual: number; forecast: number }[]) {
        const usable = rows.filter((r) => r.actual > 0)
        if (!usable.length) return null
        return (
            usable.reduce((s, r) => s + Math.abs(r.actual - r.forecast) / r.actual, 0) / usable.length
        )
    }

    // Portfolio WAPE by month
    const byTestMonth = new Map<string, { actual: number; forecast: number }[]>()
    for (const r of btRows) {
        const list = byTestMonth.get(r.month) ?? []
        list.push(r)
        byTestMonth.set(r.month, list)
    }
    const monthlyAccuracy = [...byTestMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, rows]) => ({
            month,
            wape: wape(rows),
            mape: mape(rows),
            unitsActual: rows.reduce((s, r) => s + r.actual, 0),
            unitsFc: rows.reduce((s, r) => s + r.forecast, 0),
            n: rows.length,
        }))

    // Per-group accuracy (all holdouts)
    const byGroup = new Map<string, BtRow[]>()
    for (const r of btRows) {
        const list = byGroup.get(r.group) ?? []
        list.push(r)
        byGroup.set(r.group, list)
    }

    // ── Recommend for next forecast origin = after lastOrderDate (Aug 2026) ──
    // Conservative rule (from backtest): short history → keep Trend/Momentum near 1.
    // Only trust fitted T/M when group walk-forward WAPE ≥ 25%.
    const asOf = FORECAST_MONTHS[0] // 2026-08
    const recommendations = [...groupSkus.keys()]
        .map((name) => {
            const byM = monthly.get(name) ?? new Map()
            const series = [...byM.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([month, v]) => ({ month, units: v.units, revenue: v.revenue }))

            const fitted = fitParams(
                series,
                name,
                asOf,
                partial ? { month: lastMonth, day: lastDay } : undefined,
            )

            const gRows = byGroup.get(name) ?? []
            const gWape = wape(gRows)
            const gMape = mape(gRows)
            const histMonths = series.filter((s) => s.units > 0).length

            // Backtest-aware recommendation
            let trend = 1
            let momentum = 1
            let conf: "high" | "medium" | "low" = "low"
            let recNote = ""
            if (fitted.gate === 0) {
                trend = 1
                momentum = 1
                conf = "high"
                recNote = "EOL / Gate 0"
            } else if (histMonths < 3 || gWape == null) {
                trend = 1
                momentum = 1
                conf = "low"
                recNote = "ประวัติสั้น → ใช้ T/M = 1.0"
            } else if ((gWape ?? 0) >= 0.25) {
                // Trust fitted but soft-clip
                trend = clip(fitted.trend, 0.85, 1.25)
                momentum = clip(fitted.momentum, 0.85, 1.25)
                conf = "high"
                recNote = `backtest WAPE ${(gWape * 100).toFixed(0)}% — ใช้ค่าจากประวัติ`
            } else if ((gWape ?? 0) >= 0) {
                // Mild signal only
                trend = clip(1 + (fitted.trend - 1) * 0.4, 0.9, 1.15)
                momentum = clip(1 + (fitted.momentum - 1) * 0.4, 0.9, 1.15)
                conf = "medium"
                recNote = `backtest อ่อน (${(gWape * 100).toFixed(0)}%) — ดึงเข้าใกล้ 1.0`
            } else {
                trend = 1
                momentum = 1
                conf = "low"
                recNote = `โมเดลแย่กว่า naive (WAPE ${(gWape * 100).toFixed(0)}%) → T/M = 1.0`
            }

            // Type: only mark summer if enough history
            const type =
                histMonths >= 4 && fitted.type === "หน้าร้อน" ? ("หน้าร้อน" as const) : ("ทั่วไป" as const)

            const base = Math.round(fitted.base)
            const gate = fitted.gate

            const fcMonths = FORECAST_MONTHS.map((m, i) => ({
                month: m,
                units: forecastH(base, trend, momentum, gate, type, i + 1),
            }))
            const fcAug = fcMonths[0].units
            const fcTotal = fcMonths.reduce((s, r) => s + r.units, 0)
            const avgFc = fcTotal / fcMonths.length

            const skus = groupSkus.get(name) ?? []
            let current = 0,
                inTransit = 0
            const cogsVals: number[] = []
            for (const sku of skus) {
                const st = stockBySku.get(sku)
                if (st) {
                    current += st.current
                    inTransit += st.inTransit
                }
                const c = poCost.get(sku) ?? 0
                if (c > 0) cogsVals.push(c)
            }
            const cogs = cogsVals.length ? cogsVals.reduce((a, b) => a + b, 0) / cogsVals.length : 0
            const available = current + inTransit
            const safety = avgFc * SAFETY_MONTHS
            const leadDemand = (avgFc / 30) * LEAD_DAYS
            const rop = leadDemand + safety
            const orderUpTo = leadDemand + avgFc * ORDER_CYCLE_MONTHS + safety
            const nextOrderQty = available < rop ? Math.max(orderUpTo - available, 0) : 0
            const nextOrderBudget = nextOrderQty * cogs

            const totalRev = series.reduce((s, r) => s + r.revenue, 0)
            const totalUnits = series.reduce((s, r) => s + r.units, 0)
            const asp = totalUnits > 0 ? totalRev / totalUnits : 0

            const lastAct = series.find((s) => s.month === lastMonth)
            const lastActAdj = lastAct
                ? partial
                    ? lastAct.units * (30 / lastDay)
                    : lastAct.units
                : 0

            // Also compute with page defaults (T=1,M=1) for comparison of Aug
            const fcAugFlat = forecastH(base, 1, 1, gate, "ทั่วไป", 1)

            return {
                name,
                base,
                trend: round(trend),
                momentum: round(momentum),
                gate,
                type,
                fittedTrend: fitted.trend,
                fittedMomentum: fitted.momentum,
                fittedType: fitted.type,
                conf,
                recNote,
                lastActAdj: round(lastActAdj, 1),
                fcAug: round(fcAug, 1),
                fcAugFlat: round(fcAugFlat, 1),
                fcTotal: round(fcTotal, 1),
                available: round(available, 0),
                currentStock: round(current, 0),
                inTransit: round(inTransit, 0),
                rop: round(rop, 0),
                nextOrderQty: Math.ceil(nextOrderQty),
                nextOrderBudget: Math.round(nextOrderBudget),
                cogs: round(cogs, 2),
                asp: round(asp, 0),
                backtestWape: gWape,
                backtestMape: gMape,
                backtestN: gRows.length,
                histMonths,
                monthlyHistory: series.map((s) => ({
                    month: s.month,
                    units: round(s.units, 1),
                })),
            }
        })
        .sort((a, b) => b.nextOrderBudget - a.nextOrderBudget)

    const modelAcc = wape(btRows)
    const naiveAcc = wape(naiveRows)
    const modelMape = mape(btRows)
    const naiveMape = mape(naiveRows)

    // Re-score recommended model vs naive on last holdout month only (Jul)
    const julRows = btRows.filter((r) => r.month === "2026-07")
    const julWape = wape(julRows)

    const totalNextOrder = recommendations.reduce((s, r) => s + r.nextOrderBudget, 0)
    const totalNextQty = recommendations.reduce((s, r) => s + r.nextOrderQty, 0)
    const totalFcAug = recommendations.reduce((s, r) => s + r.fcAug, 0)
    const totalFcAugRev = recommendations.reduce((s, r) => s + r.fcAug * r.asp, 0)
    const totalFcAugFlat = recommendations.reduce((s, r) => s + r.fcAugFlat, 0)

    const out = {
        generatedAt: new Date().toISOString(),
        lastOrderDate,
        lastMonth,
        partialMonth: partial,
        lastDay,
        methodology: {
            base: "avg units of last 2 months (Jul partial → ×30/day)",
            trendMomentum:
                "fitted from MoM, then shrunk toward 1.0 unless group walk-forward WAPE ≥ 25%",
            gate: "0 if EOL list or no sales in last 2 months; else 1",
            formula: "Base × Trend^(0.5^(h-1)) × seasonal × 0.8 × Momentum^(0.6^(h-1)) × Gate",
            order:
                "if available < ROP: orderUpTo(lead 45d + cycle 2mo + safety 1.5mo) − available",
            backtest: "walk-forward 1-month ahead; compare to naive = avg last 2 months",
        },
        accuracy: {
            modelWape: modelAcc,
            modelMape,
            naiveWape: naiveAcc,
            naiveMape,
            julyHoldoutWape: julWape,
            nPoints: btRows.length,
            monthlyAccuracy,
            beatNaive: modelAcc != null && naiveAcc != null ? modelAcc > naiveAcc : null,
            insight:
                modelAcc != null && naiveAcc != null && modelAcc < naiveAcc
                    ? "Raw Trend/Momentum overfit on short new-product history — recommendations shrink T/M toward 1.0"
                    : "Fitted model competitive with naive baseline",
        },
        portfolio: {
            fcAugUnits: round(totalFcAug, 0),
            fcAugUnitsFlat: round(totalFcAugFlat, 0),
            fcAugRevenue: Math.round(totalFcAugRev),
            nextOrderQty: totalNextQty,
            nextOrderBudget: totalNextOrder,
            productsToOrder: recommendations.filter((r) => r.nextOrderQty > 0).length,
        },
        recommendations,
    }

    const path = "/tmp/whatif-backtest-result.json"
    writeFileSync(path, JSON.stringify(out, null, 2))
    console.log(
        JSON.stringify(
            {
                lastOrderDate,
                accuracy: out.accuracy,
                portfolio: out.portfolio,
                topOrders: recommendations
                    .filter((r) => r.nextOrderQty > 0)
                    .slice(0, 12)
                    .map((r) => ({
                        name: r.name,
                        trend: r.trend,
                        momentum: r.momentum,
                        gate: r.gate,
                        type: r.type,
                        conf: r.conf,
                        fcAug: r.fcAug,
                        orderQty: r.nextOrderQty,
                        orderBaht: r.nextOrderBudget,
                        wape: r.backtestWape,
                        note: r.recNote,
                    })),
                path,
            },
            null,
            2,
        ),
    )
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
