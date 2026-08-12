"use client"

/**
 * Interactive what-if forecast dashboard (Thai) — New 2026 products.
 * Forecast(h) = Base × Trend^(0.5^(h-1)) × Seasonal(month) × Shrink ×
 *               Momentum^(0.6^(h-1)) × Gate × KOL_boost(month)
 * h = 1..5 → ส.ค.–ธ.ค. 2026 · Revenue = units × ASP
 */

import { Fragment, useEffect, useMemo, useState } from "react"
import type { WhatIfData, WhatIfGroup } from "@/lib/analytics/what-if"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Bar,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

// ─── constants ───────────────────────────────────────────────────────────────

const BRAND = "#1F4E5F"
const FORECAST_MONTHS = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]
const TH_MONTHS = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
]
const FORECAST_TH = ["ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const SETTINGS_KEY = "what-if-table-settings-v1"

const DEFAULT_GLOBALS = {
    shrink: 0.8,
    seasonalSummer: [1.2, 1.2, 1.4, 1.8, 2.0],
    seasonalGeneral: [1.0, 1.05, 1.05, 1.2, 1.25],
    safetyMonths: 1.5,
    leadTimeDays: 45,
    orderCycleMonths: 2.0,
    kolLiftPct: 0,
}

type Globals = typeof DEFAULT_GLOBALS

interface ProductParams {
    base: number
    trend: number
    momentum: number
    gate: number
    type: "หน้าร้อน" | "ทั่วไป"
    kolMonths: boolean[]
}

interface Scenario {
    name: string
    savedAt: string
    forecastUnits: number
    forecastRevenue: number
    buyBudget: number
    globals: Globals
    products: Record<string, ProductParams>
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const thb = (n: number) =>
    `฿${Math.round(n).toLocaleString("th-TH")}`
const numFmt = (n: number, d = 0) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d })
const monthTh = (ym: string) => {
    const m = parseInt(ym.slice(5, 7), 10)
    return `${TH_MONTHS[m - 1]} ${ym.slice(2, 4)}`
}

function defaultProducts(groups: WhatIfGroup[]): Record<string, ProductParams> {
    const out: Record<string, ProductParams> = {}
    for (const g of groups) {
        out[g.name] = {
            base: g.defaults.base,
            trend: g.defaults.trend,
            momentum: g.defaults.momentum,
            gate: g.defaults.gate,
            type: g.defaults.type,
            kolMonths: [false, false, false, false, false],
        }
    }
    return out
}

function normalizeProduct(raw: Partial<ProductParams> | undefined, fallback: ProductParams): ProductParams {
    const kol = Array.isArray(raw?.kolMonths) ? raw!.kolMonths!.slice(0, 5) : fallback.kolMonths
    while (kol.length < 5) kol.push(false)
    return {
        base: Number.isFinite(raw?.base) ? Number(raw!.base) : fallback.base,
        trend: Number.isFinite(raw?.trend) ? Number(raw!.trend) : fallback.trend,
        momentum: Number.isFinite(raw?.momentum) ? Number(raw!.momentum) : fallback.momentum,
        gate: Number.isFinite(raw?.gate) ? Number(raw!.gate) : fallback.gate,
        type: raw?.type === "หน้าร้อน" || raw?.type === "ทั่วไป" ? raw.type : fallback.type,
        kolMonths: kol.map(Boolean),
    }
}

function loadSavedSettings(groups: WhatIfGroup[]): {
    products: Record<string, ProductParams>
    globals: Globals
    savedAt: string | null
} {
    const defaults = defaultProducts(groups)
    const baseGlobals = { ...DEFAULT_GLOBALS }
    if (typeof window === "undefined") {
        return { products: defaults, globals: baseGlobals, savedAt: null }
    }
    try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (!raw) return { products: defaults, globals: baseGlobals, savedAt: null }
        const parsed = JSON.parse(raw) as {
            products?: Record<string, Partial<ProductParams>>
            globals?: Partial<Globals>
            savedAt?: string
        }
        const products: Record<string, ProductParams> = {}
        for (const g of groups) {
            products[g.name] = normalizeProduct(parsed.products?.[g.name], defaults[g.name])
        }
        const globals: Globals = {
            ...baseGlobals,
            ...(parsed.globals ?? {}),
            seasonalSummer: Array.isArray(parsed.globals?.seasonalSummer)
                ? (parsed.globals!.seasonalSummer as number[])
                : baseGlobals.seasonalSummer,
            seasonalGeneral: Array.isArray(parsed.globals?.seasonalGeneral)
                ? (parsed.globals!.seasonalGeneral as number[])
                : baseGlobals.seasonalGeneral,
        }
        return { products, globals, savedAt: parsed.savedAt ?? null }
    } catch {
        return { products: defaults, globals: baseGlobals, savedAt: null }
    }
}

function saveSettings(products: Record<string, ProductParams>, globals: Globals) {
    if (typeof window === "undefined") return
    try {
        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify({
                products,
                globals,
                savedAt: new Date().toISOString(),
            }),
        )
    } catch {
        /* ignore quota */
    }
}

function forecastUnits(p: ProductParams, globals: Globals, h: number): number {
    if (p.gate === 0) return 0
    const seasonal =
        p.type === "หน้าร้อน" ? globals.seasonalSummer[h - 1] : globals.seasonalGeneral[h - 1]
    const kolBoost = p.kolMonths[h - 1] ? 1 + globals.kolLiftPct / 100 : 1
    return (
        p.base *
        Math.pow(p.trend, Math.pow(0.5, h - 1)) *
        seasonal *
        globals.shrink *
        Math.pow(p.momentum, Math.pow(0.6, h - 1)) *
        p.gate *
        kolBoost
    )
}

/** 1-month-ahead forecast for an arbitrary calendar month (walk-forward backtest). */
function forecastCalendarMonth(
    p: Omit<ProductParams, "kolMonths"> & { base: number },
    globals: Globals,
    ym: string,
): number {
    if (p.gate === 0 || p.base <= 0) return 0
    const mm = parseInt(ym.slice(5, 7), 10)
    let seasonal = 1
    if (mm >= 8 && mm <= 12) {
        const h = mm - 7
        seasonal = p.type === "หน้าร้อน" ? globals.seasonalSummer[h - 1] : globals.seasonalGeneral[h - 1]
    }
    return p.base * p.trend * seasonal * globals.shrink * p.momentum * p.gate
}

type AccMonthRow = {
    month: string
    actual: number
    forecast: number
    absErr: number
    /** 1 − |err|/actual when actual > 0; null if no sales */
    accuracy: number | null
}

/** Walk-forward: Base = avg of prior 2 months; Trend/Momentum/Gate/Type = current table settings.
 *  Incomplete latest month: keep actual as MTD raw; scale forecast × monthElapsed for a fair compare.
 */
function buildAccuracyHistory(
    monthly: { month: string; units: number }[],
    p: ProductParams,
    globals: Globals,
    lastMonth: string,
    monthElapsed: number,
): { rows: AccMonthRow[]; overall: number | null; n: number } {
    const series = [...monthly].sort((a, b) => a.month.localeCompare(b.month))
    const rows: AccMonthRow[] = []
    for (let i = 2; i < series.length; i++) {
        const target = series[i]
        const actual = target.units // always raw MTD / full-month sheet units
        const prev = series.slice(i - 2, i).map((r) => r.units)
        const base = (prev[0] + prev[1]) / 2
        let forecast = forecastCalendarMonth(
            { base, trend: p.trend, momentum: p.momentum, gate: p.gate, type: p.type },
            globals,
            target.month,
        )
        if (target.month === lastMonth && monthElapsed < 1) {
            forecast *= monthElapsed
        }
        const absErr = Math.abs(actual - forecast)
        const accuracy = actual > 0 ? Math.max(0, 1 - absErr / actual) : forecast === 0 ? 1 : null
        if (actual > 0 || forecast > 0) {
            rows.push({ month: target.month, actual, forecast, absErr, accuracy })
        }
    }
    const den = rows.reduce((s, r) => s + r.actual, 0)
    const numErr = rows.reduce((s, r) => s + r.absErr, 0)
    const overall = den > 0 ? Math.max(0, 1 - numErr / den) : null
    return { rows, overall, n: rows.length }
}

// ─── small UI atoms ──────────────────────────────────────────────────────────

function SliderRow({
    label, value, min, max, step, onChange, warn, fmt,
}: {
    label: string
    value: number
    min: number
    max: number
    step: number
    onChange: (v: number) => void
    warn?: string | null
    fmt?: (v: number) => string
}) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold tabular-nums">
                    {fmt ? fmt(value) : value}
                    {warn && <span className="ml-1 text-red-600">{warn}</span>}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-amber-500"
            />
        </div>
    )
}

function NumCell({
    value, onChange, warn, step = 0.05, width = "w-16",
}: {
    value: number
    onChange: (v: number) => void
    warn?: boolean
    step?: number
    width?: string
}) {
    return (
        <input
            type="number"
            value={Number.isFinite(value) ? value : 0}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className={`${width} rounded border px-1 py-0.5 text-right text-xs tabular-nums ${
                warn
                    ? "border-red-400 bg-red-50"
                    : "border-amber-300 bg-amber-50"
            }`}
        />
    )
}

// ─── main component ──────────────────────────────────────────────────────────

export function WhatIfDashboard({ data }: { data: WhatIfData }) {
    const [globals, setGlobals] = useState<Globals>({ ...DEFAULT_GLOBALS })
    const [products, setProducts] = useState<Record<string, ProductParams>>(() =>
        defaultProducts(data.groups),
    )
    const [settingsReady, setSettingsReady] = useState(false)
    const [settingsSavedAt, setSettingsSavedAt] = useState<string | null>(null)
    const [tab, setTab] = useState<"overview" | "stock" | "kol">("overview")
    const [selected, setSelected] = useState<string>("ALL")
    const [unitMode, setUnitMode] = useState<"units" | "baht">("baht")
    const [scenarios, setScenarios] = useState<Scenario[]>([])
    const [kolDialogName, setKolDialogName] = useState<string | null>(null)
    const [kolDetailMonth, setKolDetailMonth] = useState<string | null>(null)
    const [accDialogName, setAccDialogName] = useState<string | null>(null)

    // Restore per-product + portfolio settings from localStorage (browser only).
    useEffect(() => {
        const loaded = loadSavedSettings(data.groups)
        setProducts(loaded.products)
        setGlobals(loaded.globals)
        setSettingsSavedAt(loaded.savedAt)
        setSettingsReady(true)
        // intentionally once on mount — later product-list gaps filled below
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // If sheet gains a new product group, seed defaults without wiping saved ones.
    useEffect(() => {
        if (!settingsReady) return
        setProducts((prev) => {
            let changed = false
            const next = { ...prev }
            for (const g of data.groups) {
                if (!next[g.name]) {
                    next[g.name] = defaultProducts([g])[g.name]
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [data.groups, settingsReady])

    // Persist whenever the table/sliders change.
    useEffect(() => {
        if (!settingsReady) return
        saveSettings(products, globals)
        setSettingsSavedAt(new Date().toISOString())
    }, [products, globals, settingsReady])

    const setG = <K extends keyof Globals>(k: K, v: Globals[K]) =>
        setGlobals((g) => ({ ...g, [k]: v }))
    const setP = (name: string, patch: Partial<ProductParams>) =>
        setProducts((ps) => ({ ...ps, [name]: { ...ps[name], ...patch } }))

    // ── partial-month adjustment for the latest actual month ──
    const lastDate = data.lastOrderDate // YYYY-MM-DD
    const lastMonth = lastDate.slice(0, 7)
    const lastDay = parseInt(lastDate.slice(8, 10), 10) || 30
    const daysInLastMonth = new Date(
        parseInt(lastDate.slice(0, 4), 10),
        parseInt(lastDate.slice(5, 7), 10),
        0,
    ).getDate()
    const partialMonth = lastDay < daysInLastMonth
    /** Share of month elapsed (calendar days) — for pace / expected MTD only. */
    const monthElapsed = partialMonth ? lastDay / daysInLastMonth : 1
    /**
     * Legacy run-rate factor (30/lastDay). Kept only for chart optional pace;
     * do NOT use for the "จริง" column — early month (day 1 → ×30) wildly inflates.
     */
    const partialFactor = partialMonth ? daysInLastMonth / lastDay : 1
    /** "This month" for KOL column = latest month in sheet data. */
    const kolThisMonth = lastMonth
    const kolDialogGroup = kolDialogName
        ? data.groups.find((g) => g.name === kolDialogName) ?? null
        : null
    const kolDialogParams = kolDialogName ? products[kolDialogName] : null
    /** Next month label in the forecast cycle (ส.ค. while still in Jul, etc.). */
    const orderCycleLabel = FORECAST_TH[0]

    // ── computed per group ──
    const computed = useMemo(() => {
        return data.groups.map((g) => {
            const p = products[g.name]
            const fc = FORECAST_MONTHS.map((_, i) => forecastUnits(p, globals, i + 1))
            const fcTotal = fc.reduce((s, v) => s + v, 0)
            const fcRevenue = fcTotal * g.asp
            const avgFcMonthly = fcTotal / FORECAST_MONTHS.length
            const safety = avgFcMonthly * globals.safetyMonths
            const leadDemand = (avgFcMonthly / 30) * globals.leadTimeDays
            const rop = leadDemand + safety
            const available = g.currentStock + g.inTransitStock
            // Horizon gap (ส.ค.–ธ.ค.) — planning only, not "order now"
            const shortage = Math.max(fcTotal - available, 0)
            const buyBudget = shortage * g.cogs
            const belowRop = available < rop

            // Month-by-month stock burn-down (order only what that month still needs)
            let stockCursor = available
            const monthPlan = fc.map((demand, i) => {
                const opening = stockCursor
                const orderQty = Math.max(demand - opening, 0)
                const closing = opening + orderQty - demand
                stockCursor = closing
                return {
                    month: FORECAST_MONTHS[i],
                    label: FORECAST_TH[i],
                    demand,
                    opening,
                    orderQty,
                    closing,
                    orderBudget: orderQty * g.cogs,
                    short: orderQty > 0,
                }
            })

            // Action = order for current cycle month only (first forecast month)
            const nextOrderQty = monthPlan[0]?.orderQty ?? 0
            const nextOrderBudget = nextOrderQty * g.cogs
            const laterShort = monthPlan.slice(1).find((m) => m.orderQty > 0) ?? null

            // Walk-forward forecast accuracy with current Trend/Momentum/Gate/Type
            // Incomplete latest month: compare MTD actual vs forecast×elapsed (not ×30/day).
            const acc = buildAccuracyHistory(
                g.monthly,
                p,
                globals,
                lastMonth,
                monthElapsed,
            )

            // actual latest month — raw MTD (never inflate for display)
            const actLast = g.monthly.find((m) => m.month === lastMonth)
            const actLastUnitsRaw = actLast ? actLast.units : 0
            const actLastPace = partialMonth ? actLastUnitsRaw * partialFactor : actLastUnitsRaw
            const actLastNetGp = actLast?.netGp ?? 0
            const actLastCmPct =
                actLast && actLast.revenue > 0 ? (actLast.netGp / actLast.revenue) * 100 : null
            // Forecast Aug CM: units × historical CM/unit (sales-page Net GP / units)
            const cmPerUnit = g.totalUnits > 0 ? g.totalNetGp / g.totalUnits : 0
            const fcAugCm = fc[0] * cmPerUnit

            const kolTotalPosts = g.kolMonthly.reduce((s, k) => s + k.posts, 0)
            const kolBarter = g.kolMonthly.reduce((s, k) => s + k.barterPosts, 0)
            const kolCash = g.kolMonthly.reduce((s, k) => s + k.cashBudget, 0)
            const kolViews = g.kolMonthly.reduce((s, k) => s + k.views, 0)

            // KOL lift from actual data: avg units in months WITH posts vs WITHOUT
            const postMonths = new Set(g.kolMonthly.filter((k) => k.posts > 0).map((k) => k.month))
            let withSum = 0, withN = 0, woSum = 0, woN = 0
            for (const m of g.monthly) {
                if (postMonths.has(m.month)) { withSum += m.units; withN++ }
                else { woSum += m.units; woN++ }
            }
            const liftRatio =
                withN > 0 && woN > 0 && woSum / woN > 0
                    ? (withSum / withN) / (woSum / woN)
                    : null

            return {
                g, p, fc, fcTotal, fcRevenue, avgFcMonthly, safety, rop,
                available, shortage, buyBudget,
                belowRop, nextOrderQty, nextOrderBudget, laterShort,
                monthPlan,
                accRows: acc.rows,
                accOverall: acc.overall,
                accN: acc.n,
                actLast, actLastUnitsRaw, actLastPace, actLastNetGp, actLastCmPct,
                cmPerUnit, fcAugCm,
                kolTotalPosts, kolBarter, kolCash, kolViews, liftRatio,
            }
        })
    }, [data.groups, products, globals, lastMonth, partialFactor, monthElapsed, partialMonth])

    const accDialogComputed = accDialogName
        ? computed.find((c) => c.g.name === accDialogName) ?? null
        : null

    // ── portfolio totals ──
    const totals = useMemo(() => {
        const fcRevenue = computed.reduce((s, c) => s + c.fcRevenue, 0)
        const fcUnits = computed.reduce((s, c) => s + c.fcTotal, 0)
        const actRevenue = computed.reduce((s, c) => s + c.g.totalRevenue, 0)
        const buyBudget = computed.reduce((s, c) => s + c.buyBudget, 0)
        const nextOrderBudget = computed.reduce((s, c) => s + c.nextOrderBudget, 0)

        // accuracy — only months that already passed AND have a forecast (ส.ค. onward)
        let accNum = 0, accDen = 0
        for (const fm of FORECAST_MONTHS) {
            if (fm >= lastMonth) continue // month not finished yet
            const h = FORECAST_MONTHS.indexOf(fm) + 1
            let act = 0, fc = 0
            for (const c of computed) {
                act += c.g.monthly.find((m) => m.month === fm)?.units ?? 0
                fc += forecastUnits(c.p, globals, h)
            }
            if (act > 0) { accNum += Math.abs(act - fc); accDen += act }
        }
        const accuracy = accDen > 0 ? Math.max(0, 1 - accNum / accDen) : null

        return { fcRevenue, fcUnits, actRevenue, buyBudget, nextOrderBudget, accuracy }
    }, [computed, globals, lastMonth])

    // ── chart series ──
    const chartData = useMemo(() => {
        const sel = selected === "ALL" ? computed : computed.filter((c) => c.g.name === selected)
        const monthSet = new Set<string>()
        for (const c of sel) for (const m of c.g.monthly) monthSet.add(m.month)
        for (const fm of FORECAST_MONTHS) monthSet.add(fm)
        const months = [...monthSet].sort()

        return months.map((m) => {
            let actualRaw = 0, actualRev = 0
            for (const c of sel) {
                const row = c.g.monthly.find((x) => x.month === m)
                if (row) { actualRaw += row.units; actualRev += row.revenue }
            }
            const isPartial = m === lastMonth && partialMonth
            // Chart: show raw MTD for incomplete month (not ×30/day run-rate)
            const actUnits = actualRaw
            const actRev = actualRev

            const h = FORECAST_MONTHS.indexOf(m) + 1
            let fcU: number | null = null, fcR: number | null = null
            if (h >= 1) {
                fcU = sel.reduce((s, c) => s + forecastUnits(c.p, globals, h), 0)
                fcR = sel.reduce((s, c) => s + forecastUnits(c.p, globals, h) * c.g.asp, 0)
                // Pace-compare on incomplete month: expected MTD = full-month fc × elapsed
                if (isPartial) {
                    fcU *= monthElapsed
                    fcR! *= monthElapsed
                }
            }
            const hasActual = m <= lastMonth && actualRaw > 0
            const actual = unitMode === "baht" ? (hasActual ? actRev : null) : (hasActual ? actUnits : null)
            const forecast = fcU != null ? (unitMode === "baht" ? fcR : fcU) : null

            let barColor = BRAND
            if (actual != null && forecast != null && forecast > 0) {
                if (actual < forecast * 0.8) barColor = "#dc2626"
                else if (actual > forecast) barColor = "#16a34a"
            }
            return {
                month: m,
                label: monthTh(m) + (isPartial ? " MTD" : ""),
                actual,
                forecast,
                barColor,
                future: m > lastMonth,
            }
        })
    }, [computed, selected, globals, unitMode, lastMonth, partialMonth, monthElapsed])

    const resetAll = () => {
        setGlobals({ ...DEFAULT_GLOBALS })
        setProducts(defaultProducts(data.groups))
        try {
            localStorage.removeItem(SETTINGS_KEY)
        } catch {
            /* ignore */
        }
        setSettingsSavedAt(null)
    }

    const saveScenario = () => {
        setScenarios((s) => [
            ...s,
            {
                name: `Scenario ${s.length + 1}`,
                savedAt: new Date().toLocaleTimeString("th-TH"),
                forecastUnits: totals.fcUnits,
                forecastRevenue: totals.fcRevenue,
                buyBudget: totals.nextOrderBudget,
                globals: JSON.parse(JSON.stringify(globals)),
                products: JSON.parse(JSON.stringify(products)),
            },
        ])
    }
    const loadScenario = (sc: Scenario) => {
        setGlobals(JSON.parse(JSON.stringify(sc.globals)))
        setProducts(JSON.parse(JSON.stringify(sc.products)))
    }

    const totalKolPosts = computed.reduce((s, c) => s + c.kolTotalPosts, 0)

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="rounded-xl p-5 text-white" style={{ background: BRAND }}>
                <h1 className="text-xl sm:text-2xl font-bold">
                    What-if Dashboard — สินค้าใหม่ 2026
                </h1>
                <p className="text-sm opacity-80 mt-1">
                    พยากรณ์ ส.ค.–ธ.ค. 2026 เทียบยอดขายจริงจาก Google Sheet ·
                    ข้อมูลถึง {lastDate || "—"} · สีเหลือง = ปรับได้
                </p>
            </div>

            {/* Missing forecast tab banner */}
            {!data.forecastTabFound && (
                <div className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                    ⚠️ ไม่พบชีต &quot;{data.forecastTabName}&quot; ใน Google Sheet —
                    ค่า Base/Trend/Momentum/Gate ใช้ค่าตั้งต้นอัตโนมัติ
                    (Base = ยอดจริงเฉลี่ย 2 เดือนล่าสุด · Trend/Momentum = 1.0 ·
                    Gate = 0 เฉพาะ Nugget Ice Neo และ Lamp Learning desk) ·
                    ASP มาจากยอดจริง · COGS มาจาก po_costs (weighted_avg_cost) — แก้ inline ได้ทุกช่อง
                </div>
            )}

            {/* KPI cards */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                {[
                    { t: "รายได้พยากรณ์รวม (ส.ค.–ธ.ค.)", v: thb(totals.fcRevenue), c: "text-sky-800", tag: "พยากรณ์" },
                    { t: "ยอดขายจริงสะสม (จากชีต)", v: thb(totals.actRevenue), c: "text-emerald-700", tag: "จริง" },
                    {
                        t: "ความแม่น% (เดือนที่ผ่านแล้ว)",
                        v: totals.accuracy != null ? `${(totals.accuracy * 100).toFixed(1)}%` : "ยังไม่มีเดือนเทียบ",
                        c: "text-slate-700", tag: "เทียบ",
                    },
                    { t: "งบขาด ส.ค.–ธ.ค. (แผน)", v: thb(totals.buyBudget), c: "text-slate-700", tag: "แผน" },
                    { t: `งบสั่ง ${orderCycleLabel} (Action)`, v: thb(totals.nextOrderBudget), c: "text-orange-700", tag: "สั่งซื้อ" },
                ].map((k) => (
                    <div key={k.t} className="rounded-lg border bg-white p-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] text-slate-500">{k.t}</p>
                            <span className={`text-[10px] rounded px-1 ${
                                k.tag === "จริง" ? "bg-emerald-100 text-emerald-700"
                                : k.tag === "เทียบ" ? "bg-slate-100 text-slate-600"
                                : k.tag === "สั่งซื้อ" ? "bg-orange-100 text-orange-700"
                                : k.tag === "แผน" ? "bg-slate-100 text-slate-600"
                                : "bg-sky-100 text-sky-700"
                            }`}>
                                {k.tag}
                            </span>
                        </div>
                        <p className={`text-lg font-bold tabular-nums ${k.c}`}>{k.v}</p>
                    </div>
                ))}
            </div>

            {/* Tabs + actions */}
            <div className="flex flex-wrap items-center gap-2">
                {([["overview", "ภาพรวม"], ["stock", "สต็อก"], ["kol", "KOL"]] as const).map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium ${
                            tab === id ? "text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                        style={tab === id ? { background: BRAND } : undefined}
                    >
                        {label}
                    </button>
                ))}
                <div className="flex-1" />
                {settingsSavedAt && (
                    <span className="text-[11px] text-slate-400 tabular-nums">
                        บันทึกตารางแล้ว {new Date(settingsSavedAt).toLocaleString("th-TH")}
                    </span>
                )}
                <button onClick={resetAll} className="px-3 py-1.5 rounded-md border text-sm hover:bg-slate-50">
                    รีเซ็ตทั้งหมด
                </button>
                <button onClick={saveScenario} className="px-3 py-1.5 rounded-md text-sm text-white" style={{ background: BRAND }}>
                    บันทึก Scenario
                </button>
            </div>

            {/* Global sliders */}
            <div className="rounded-lg border bg-white p-4">
                <p className="text-sm font-semibold mb-3" style={{ color: BRAND }}>
                    แผงปรับตัวแปรระดับพอร์ต <span className="text-amber-600 text-xs">(เหลือง = ปรับได้ · คำนวณใหม่ทันที)</span>
                </p>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    <SliderRow label="Shrink" value={globals.shrink} min={0.6} max={1.1} step={0.01}
                        onChange={(v) => setG("shrink", v)} />
                    <SliderRow label="Safety stock (เดือน)" value={globals.safetyMonths} min={0.5} max={3} step={0.1}
                        onChange={(v) => setG("safetyMonths", v)} />
                    <SliderRow label="Lead time (วัน)" value={globals.leadTimeDays} min={15} max={90} step={1}
                        onChange={(v) => setG("leadTimeDays", v)} />
                    <SliderRow label="สั่งต่อรอบ (เดือน)" value={globals.orderCycleMonths} min={1} max={4} step={0.5}
                        onChange={(v) => setG("orderCycleMonths", v)} />
                    <SliderRow label="KOL lift% (เดือนที่ยิง)" value={globals.kolLiftPct} min={0} max={100} step={1}
                        onChange={(v) => setG("kolLiftPct", v)}
                        warn={globals.kolLiftPct > 30 ? "⚠️ เกินที่วัดได้จริง" : null}
                        fmt={(v) => `+${v}%`} />
                </div>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 mt-4">
                    <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">ดัชนีฤดูกาล หน้าร้อน (ส.ค.–ธ.ค.)</p>
                        <div className="grid grid-cols-5 gap-2">
                            {globals.seasonalSummer.map((v, i) => (
                                <div key={i} className="text-center">
                                    <p className="text-[10px] text-slate-500">{FORECAST_TH[i]}</p>
                                    <NumCell value={v} step={0.05} width="w-full"
                                        onChange={(nv) => {
                                            const arr = [...globals.seasonalSummer]
                                            arr[i] = Math.min(2.5, Math.max(0.3, nv))
                                            setG("seasonalSummer", arr)
                                        }} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-slate-600 mb-2">ดัชนีฤดูกาล ทั่วไป (ส.ค.–ธ.ค.)</p>
                        <div className="grid grid-cols-5 gap-2">
                            {globals.seasonalGeneral.map((v, i) => (
                                <div key={i} className="text-center">
                                    <p className="text-[10px] text-slate-500">{FORECAST_TH[i]}</p>
                                    <NumCell value={v} step={0.05} width="w-full"
                                        onChange={(nv) => {
                                            const arr = [...globals.seasonalGeneral]
                                            arr[i] = Math.min(2.5, Math.max(0.3, nv))
                                            setG("seasonalGeneral", arr)
                                        }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Scenarios */}
            {scenarios.length > 0 && (
                <div className="rounded-lg border bg-white p-4 overflow-x-auto">
                    <p className="text-sm font-semibold mb-2" style={{ color: BRAND }}>เทียบ Scenario</p>
                    <table className="text-xs min-w-[520px] w-full">
                        <thead>
                            <tr className="text-slate-500 border-b">
                                <th className="text-left py-1">ชื่อ</th>
                                <th className="text-right">พยากรณ์ (ชิ้น)</th>
                                <th className="text-right">รายได้พยากรณ์</th>
                                <th className="text-right">งบสั่งรอบถัดไป</th>
                                <th className="text-right">เวลา</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {scenarios.map((sc, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="py-1 font-medium">{sc.name}</td>
                                    <td className="text-right tabular-nums">{numFmt(sc.forecastUnits)}</td>
                                    <td className="text-right tabular-nums">{thb(sc.forecastRevenue)}</td>
                                    <td className="text-right tabular-nums">{thb(sc.buyBudget)}</td>
                                    <td className="text-right text-slate-400">{sc.savedAt}</td>
                                    <td className="text-right">
                                        <button onClick={() => loadScenario(sc)} className="text-sky-700 underline">ใช้ค่านี้</button>
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-slate-50">
                                <td className="py-1 font-medium">ปัจจุบัน</td>
                                <td className="text-right tabular-nums">{numFmt(totals.fcUnits)}</td>
                                <td className="text-right tabular-nums">{thb(totals.fcRevenue)}</td>
                                <td className="text-right tabular-nums">{thb(totals.nextOrderBudget)}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── TAB: overview ── */}
            {tab === "overview" && (
                <>
                    <div className="rounded-lg border bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className="text-sm font-semibold" style={{ color: BRAND }}>
                                พยากรณ์ (เส้น) vs ยอดจริง (แท่ง)
                            </p>
                            <span className="text-[11px] text-slate-500">
                                แท่งแดง = จริงต่ำกว่าพยากรณ์ &gt;20% · เขียว = สูงกว่า · MTD = ยอดสะสมเดือนนี้ (ยังไม่ครบเดือน)
                            </span>
                            <div className="flex-1" />
                            <select
                                value={selected}
                                onChange={(e) => setSelected(e.target.value)}
                                className="rounded border px-2 py-1 text-sm bg-amber-50 border-amber-300"
                            >
                                <option value="ALL">รวมพอร์ต (ทุกสินค้า)</option>
                                {data.groups.map((g) => (
                                    <option key={g.name} value={g.name}>{g.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setUnitMode(unitMode === "baht" ? "units" : "baht")}
                                className="rounded border px-2 py-1 text-sm hover:bg-slate-50"
                            >
                                หน่วย: {unitMode === "baht" ? "฿ บาท" : "ชิ้น"}
                            </button>
                        </div>
                        <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 10, right: 16, bottom: 4, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => unitMode === "baht" ? `${(Number(v) / 1000).toFixed(0)}K` : numFmt(Number(v))} />
                                    <Tooltip
                                        formatter={(v, name) => [
                                            unitMode === "baht" ? thb(Number(v ?? 0)) : `${numFmt(Number(v ?? 0))} ชิ้น`,
                                            name === "actual" ? "ยอดจริง" : "พยากรณ์",
                                        ]}
                                    />
                                    <Legend formatter={(v) => (v === "actual" ? "ยอดจริง (ชีต)" : "พยากรณ์ (สูตร)")} wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="actual" name="actual" radius={[3, 3, 0, 0]}>
                                        {chartData.map((d) => (
                                            <Cell key={d.month} fill={d.barColor} />
                                        ))}
                                    </Bar>
                                    <Line
                                        dataKey="forecast" name="forecast" type="monotone"
                                        stroke="#f59e0b" strokeWidth={2.5}
                                        strokeDasharray="6 3"
                                        dot={{ r: 3, fill: "#f59e0b" }}
                                        connectNulls
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                            เดือนอนาคตแสดงพยากรณ์อย่างเดียว (เส้นประ) · เดือนปัจจุบันแสดงยอดสะสมจริง (MTD) เทียบพยากรณ์แบบ pace ·
                            ความแม่นระยะไกล: WAPE 1 เดือน ≈ 34% / 3 เดือน ≈ 90% — เดือนไกลเชื่อถือได้น้อยลง
                        </p>
                    </div>

                    {/* Per-product table */}
                    <div className="rounded-lg border bg-white p-4">
                        <p className="text-sm font-semibold mb-2" style={{ color: BRAND }}>
                            ตารางรายสินค้า{" "}
                            <span className="text-amber-600 text-xs">
                                (ช่องเหลืองแก้ได้ · บันทึกอัตโนมัติในเบราว์เซอร์ · Gate=0 → พยากรณ์ 0 เสมอ)
                            </span>
                        </p>
                        <div className="max-h-[70vh] overflow-auto border border-slate-100 rounded-md">
                        <table className="w-full text-xs min-w-[1100px] border-separate border-spacing-0">
                            <thead className="sticky top-0 z-20">
                                <tr className="text-slate-600 bg-slate-100">
                                    <th className="sticky left-0 z-30 bg-slate-100 text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">สินค้า</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">ประเภท</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">Base</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">Trend</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">Momentum</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">Gate</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">KOL {monthTh(kolThisMonth)}</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">พยากรณ์ ส.ค. (ชิ้น)</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">
                                        จริง {monthTh(lastMonth)}
                                        {partialMonth ? " MTD" : ""}
                                    </th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">ต่าง%{partialMonth ? " (pace)" : ""}</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap" title="Net GP = revenue×(1−channel deduction) − COGS · same as Sales">
                                        CM {monthTh(lastMonth)}{partialMonth ? " MTD" : ""}
                                    </th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap" title="CM% = Net GP / revenue · lifetime actual">
                                        CM%
                                    </th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap" title="พยากรณ์ ส.ค. × CM/ชิ้น จากยอดจริง">
                                        CM พยากรณ์ ส.ค.
                                    </th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">ความแม่น%</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">สต็อก+ทาง</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">สั่ง {orderCycleLabel} (ชิ้น)</th>
                                    <th className="text-center py-2 px-2 font-semibold border-b border-slate-200 whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {computed.map((c, rowIdx) => {
                                    const p = c.p
                                    const g = c.g
                                    const trendWarn = p.trend > 1.5
                                    const momWarn = p.momentum > 1.5
                                    const baseWarn =
                                        g.defaults.base > 0 &&
                                        Math.abs(p.base - g.defaults.base) / g.defaults.base > 0.5
                                    const fcAug = c.fc[0]
                                    const fcAugExpectedMtd = partialMonth ? fcAug * monthElapsed : fcAug
                                    const diffPct =
                                        c.actLastUnitsRaw > 0 && fcAugExpectedMtd > 0
                                            ? ((c.actLastUnitsRaw - fcAugExpectedMtd) / fcAugExpectedMtd) * 100
                                            : null
                                    const kolThis = g.kolMonthly.find((k) => k.month === kolThisMonth)
                                    const kolThisPosts = kolThis?.posts ?? 0
                                    const kolPlanCount = p.kolMonths.filter(Boolean).length
                                    const accPct = c.accOverall
                                    const accTone =
                                        accPct == null
                                            ? "text-slate-400"
                                            : accPct >= 0.7
                                              ? "text-emerald-700"
                                              : accPct >= 0.4
                                                ? "text-amber-700"
                                                : "text-red-600"
                                    const rowBg = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/80"
                                    return (
                                        <tr key={g.name} className={`group border-b last:border-0 ${rowBg} hover:bg-sky-50/70`}>
                                            <td className={`sticky left-0 z-10 py-1.5 px-2 font-medium whitespace-nowrap max-w-[160px] truncate border-r border-slate-100 ${rowBg} group-hover:bg-sky-50`}>
                                                {g.name}
                                                {p.gate === 0 && <span className="ml-1 text-[10px] text-red-600">(Gate 0)</span>}
                                            </td>
                                            <td className="text-center">
                                                <select
                                                    value={p.type}
                                                    onChange={(e) => setP(g.name, { type: e.target.value as ProductParams["type"] })}
                                                    className="rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[11px]"
                                                >
                                                    <option value="ทั่วไป">ทั่วไป</option>
                                                    <option value="หน้าร้อน">หน้าร้อน</option>
                                                </select>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <NumCell value={p.base} step={1} warn={baseWarn}
                                                        onChange={(v) => setP(g.name, { base: v })} />
                                                    {baseWarn && <span className="text-[9px] text-orange-600">ต่างจากเดิม &gt;±50%</span>}
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <NumCell value={p.trend} warn={trendWarn}
                                                        onChange={(v) => setP(g.name, { trend: v })} />
                                                    {trendWarn && <span className="text-[9px] text-red-600">backtest: เกิน 1.5 ความแม่นตก</span>}
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <NumCell value={p.momentum} warn={momWarn}
                                                        onChange={(v) => setP(g.name, { momentum: v })} />
                                                    {momWarn && <span className="text-[9px] text-red-600">backtest: เกิน 1.5 ความแม่นตก</span>}
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                <NumCell value={p.gate} step={0.1} width="w-12"
                                                    onChange={(v) => setP(g.name, { gate: Math.max(0, v) })} />
                                            </td>
                                            <td className="text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setKolDialogName(g.name)
                                                        setKolDetailMonth(kolThisMonth)
                                                    }}
                                                    className="inline-flex flex-col items-center rounded border border-slate-200 bg-slate-50 px-2 py-1 hover:border-sky-400 hover:bg-sky-50 transition-colors min-w-[72px]"
                                                    title="คลิกดู KOL ทุกเดือน + รายละเอียดชื่อ/ช่องทาง/ลิงก์"
                                                >
                                                    <span className={`tabular-nums font-semibold ${kolThisPosts > 0 ? "text-sky-800" : "text-slate-400"}`}>
                                                        {kolThisPosts > 0 ? `${numFmt(kolThisPosts)} โพสต์` : "0 โพสต์"}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500">
                                                        {kolThis?.cashBudget
                                                            ? thb(kolThis.cashBudget)
                                                            : kolThis?.barterPosts
                                                              ? `barter ${kolThis.barterPosts}`
                                                              : "คลิกดูทั้งหมด"}
                                                    </span>
                                                    {kolPlanCount > 0 && (
                                                        <span className="text-[9px] text-amber-700">แผนยิง {kolPlanCount} ด.</span>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="text-right tabular-nums font-medium text-sky-800">
                                                {numFmt(fcAug, 0)}
                                            </td>
                                            <td className="text-right tabular-nums text-emerald-700">
                                                {c.actLast ? numFmt(c.actLastUnitsRaw, 0) : "—"}
                                                {partialMonth && c.actLast && c.actLastUnitsRaw > 0 && (
                                                    <div className="text-[9px] text-slate-400">
                                                        ~{numFmt(c.actLastPace, 0)}/ด.ถ้าคงจังหวะ
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`text-right tabular-nums font-medium ${
                                                diffPct == null ? "text-slate-400" : diffPct < -20 ? "text-red-600" : diffPct > 0 ? "text-emerald-600" : "text-slate-600"
                                            }`}>
                                                {diffPct != null ? `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(0)}%` : "—"}
                                            </td>
                                            <td className={`text-right tabular-nums font-medium ${
                                                !c.actLast ? "text-slate-400" : c.actLastNetGp < 0 ? "text-red-600" : "text-emerald-700"
                                            }`}>
                                                {c.actLast ? thb(c.actLastNetGp) : "—"}
                                                {c.actLastCmPct != null && (
                                                    <div className="text-[9px] text-slate-400 font-normal">
                                                        {c.actLastCmPct.toFixed(0)}% เดือนนี้
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`text-right tabular-nums font-medium ${
                                                g.cmPct == null ? "text-slate-400" : g.cmPct < 0 ? "text-red-600" : g.cmPct < 15 ? "text-amber-700" : "text-emerald-700"
                                            }`}>
                                                {g.cmPct != null ? `${g.cmPct.toFixed(0)}%` : "—"}
                                            </td>
                                            <td className={`text-right tabular-nums ${
                                                c.fcAugCm === 0 ? "text-slate-400" : c.fcAugCm < 0 ? "text-red-600" : "text-sky-800"
                                            }`}>
                                                {p.gate === 0 || c.fc[0] <= 0 ? "—" : thb(c.fcAugCm)}
                                            </td>
                                            <td className="text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setAccDialogName(g.name)}
                                                    className={`inline-flex flex-col items-center rounded border px-2 py-1 min-w-[64px] transition-colors ${
                                                        accPct == null
                                                            ? "border-slate-200 bg-slate-50 text-slate-400"
                                                            : "border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50"
                                                    }`}
                                                    title="คลิกดูความแม่นพยากรณ์รายเดือน"
                                                >
                                                    <span className={`tabular-nums font-semibold ${accTone}`}>
                                                        {accPct != null ? `${(accPct * 100).toFixed(0)}%` : "—"}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500">
                                                        {c.accN > 0 ? `${c.accN} เดือน` : "คลิกดู"}
                                                    </span>
                                                </button>
                                            </td>
                                            <td className="text-right tabular-nums">
                                                {numFmt(c.available)}
                                                {g.inTransitStock > 0 && (
                                                    <span className="text-[9px] text-slate-400"> (+{numFmt(g.inTransitStock)} ทาง)</span>
                                                )}
                                            </td>
                                            <td className={`text-right tabular-nums ${c.nextOrderQty > 0 ? "text-orange-700 font-medium" : "text-slate-400"}`}>
                                                {c.nextOrderQty > 0 ? numFmt(Math.ceil(c.nextOrderQty)) : "0"}
                                            </td>
                                            <td className="text-left whitespace-nowrap">
                                                {p.gate === 0 ? (
                                                    <span className="text-slate-400">เลิกขาย/EOL</span>
                                                ) : c.nextOrderQty > 0 ? (
                                                    g.cogs > 0 ? (
                                                        <span className="text-orange-700 font-medium">
                                                            สั่ง {orderCycleLabel} {thb(c.nextOrderBudget)}
                                                            <span className="text-[10px] text-slate-500 font-normal">
                                                                {" "}({numFmt(Math.ceil(c.nextOrderQty))} ชิ้น)
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-orange-700">
                                                            สั่ง {orderCycleLabel} {numFmt(Math.ceil(c.nextOrderQty))} ชิ้น{" "}
                                                            <span className="text-orange-600">(ไม่มี COGS ใน po_costs)</span>
                                                        </span>
                                                    )
                                                ) : c.laterShort ? (
                                                    <span className="text-slate-500">
                                                        พอ{orderCycleLabel}
                                                        <span className="text-[10px] text-slate-400">
                                                            {" "}· ขาด{c.laterShort.label} {numFmt(Math.ceil(c.laterShort.orderQty))}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-600">พอ</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2">
                            Action / สั่ง {orderCycleLabel} = สั่งเฉพาะเดือนรอบปัจจุบันตามแผนรายเดือน
                            (max(พยากรณ์{orderCycleLabel} − สต็อกเริ่ม, 0)) · รายเดือนเต็มดูแท็บสต็อก ·
                            CM / CM% = Net GP แบบหน้า Sales: revenue×(1−channel deduction) − qty×po_costs ·
                            CM พยากรณ์ ส.ค. = พยากรณ์ชิ้น × (Net GP สะสม ÷ ชิ้นสะสม) ·
                            ค่าในตารางบันทึกอัตโนมัติในเบราว์เซอร์นี้
                        </p>
                    </div>
                </>
            )}

            {/* Forecast accuracy history dialog */}
            <Dialog open={accDialogName != null} onOpenChange={(open) => !open && setAccDialogName(null)}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>ความแม่นพยากรณ์ — {accDialogName}</DialogTitle>
                        <DialogDescription>
                            Walk-forward รายเดือน: Base = เฉลี่ย 2 เดือนก่อนหน้า · ใช้ Trend / Momentum / Gate / ประเภท จากตารางตอนนี้
                        </DialogDescription>
                    </DialogHeader>
                    {accDialogComputed && (
                        <div className="space-y-3">
                            <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                                <span>
                                    ความแม่นรวม (1−WAPE):{" "}
                                    <span className="font-semibold text-sky-800">
                                        {accDialogComputed.accOverall != null
                                            ? `${(accDialogComputed.accOverall * 100).toFixed(1)}%`
                                            : "—"}
                                    </span>
                                </span>
                                <span>{accDialogComputed.accN} เดือนที่เทียบได้</span>
                                <span>
                                    T={accDialogComputed.p.trend} · M={accDialogComputed.p.momentum} · G={accDialogComputed.p.gate}
                                </span>
                            </div>
                            {accDialogComputed.accRows.length === 0 ? (
                                <p className="text-sm text-slate-400 py-4 text-center">
                                    ประวัติสั้นเกินไป (ต้องมีอย่างน้อย 3 เดือน) — ยังเทียบความแม่นไม่ได้
                                </p>
                            ) : (
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b text-slate-500">
                                            <th className="text-left py-1.5">เดือน</th>
                                            <th className="text-right">จริง (ชิ้น)</th>
                                            <th className="text-right">พยากรณ์</th>
                                            <th className="text-right">คลาดเคลื่อน</th>
                                            <th className="text-right">แม่น%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accDialogComputed.accRows.map((r) => {
                                            const tone =
                                                r.accuracy == null
                                                    ? "text-slate-400"
                                                    : r.accuracy >= 0.7
                                                      ? "text-emerald-700"
                                                      : r.accuracy >= 0.4
                                                        ? "text-amber-700"
                                                        : "text-red-600"
                                            return (
                                                <tr key={r.month} className="border-b last:border-0">
                                                    <td className="py-1.5 whitespace-nowrap">
                                                        {monthTh(r.month)}
                                                        {r.month === lastMonth && partialMonth ? "*" : ""}
                                                    </td>
                                                    <td className="text-right tabular-nums text-emerald-700">
                                                        {numFmt(r.actual, 1)}
                                                    </td>
                                                    <td className="text-right tabular-nums text-sky-800">
                                                        {numFmt(r.forecast, 1)}
                                                    </td>
                                                    <td className="text-right tabular-nums text-slate-600">
                                                        {numFmt(r.absErr, 1)}
                                                    </td>
                                                    <td className={`text-right tabular-nums font-semibold ${tone}`}>
                                                        {r.accuracy != null ? `${(r.accuracy * 100).toFixed(0)}%` : "—"}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                            <p className="text-[11px] text-slate-400">
                                เดือนไม่ครบ: แสดงยอดสะสมจริง (MTD) · พยากรณ์ในกราฟเทียบแบบ pace (× วันผ่านไป/{daysInLastMonth}) ·
                                ไม่คูณ ×30/วันอีกต่อไป
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* KOL monthly detail dialog */}
            <Dialog
                open={kolDialogName != null}
                onOpenChange={(open) => {
                    if (!open) {
                        setKolDialogName(null)
                        setKolDetailMonth(null)
                    }
                }}
            >
                <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>KOL — {kolDialogName}</DialogTitle>
                        <DialogDescription>
                            สรุปรายเดือน + รายละเอียดแต่ละโพสต์ (ชื่อ KOL / ช่องทาง / ลิงก์) จากชีต KOL ·
                            ติ๊ก &quot;แผนยิง&quot; เพื่อใส่ KOL lift ในพยากรณ์ ส.ค.–ธ.ค.
                        </DialogDescription>
                    </DialogHeader>
                    {kolDialogGroup && kolDialogParams && (
                        <div className="space-y-4">
                            <div className="rounded-md border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                เดือนปัจจุบัน ({monthTh(kolThisMonth)}):{" "}
                                <span className="font-semibold text-sky-800">
                                    {numFmt(kolDialogGroup.kolMonthly.find((k) => k.month === kolThisMonth)?.posts ?? 0)} โพสต์
                                </span>
                                {" · "}รวมทั้งหมด {numFmt(kolDialogGroup.kolMonthly.reduce((s, k) => s + k.posts, 0))} โพสต์
                                {" · "}รายละเอียด {numFmt(kolDialogGroup.kolPosts?.length ?? 0)} รายการ
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b text-slate-500">
                                            <th className="text-left py-1.5">เดือน</th>
                                            <th className="text-right">โพสต์</th>
                                            <th className="text-right">Barter</th>
                                            <th className="text-right">งบเงินสด</th>
                                            <th className="text-right">วิว</th>
                                            <th className="text-center">แผนยิง</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const byM = new Map(kolDialogGroup.kolMonthly.map((k) => [k.month, k]))
                                            const months = [
                                                ...new Set([
                                                    ...kolDialogGroup.kolMonthly.map((k) => k.month),
                                                    ...FORECAST_MONTHS,
                                                ]),
                                            ].sort()
                                            return months.map((m) => {
                                                const row = byM.get(m)
                                                const fcIdx = FORECAST_MONTHS.indexOf(m)
                                                const isThis = m === kolThisMonth
                                                const isSelected = (kolDetailMonth ?? kolThisMonth) === m
                                                return (
                                                    <tr
                                                        key={m}
                                                        className={`border-b last:border-0 cursor-pointer ${
                                                            isSelected ? "bg-sky-50" : isThis ? "bg-sky-50/40" : "hover:bg-slate-50"
                                                        }`}
                                                        onClick={() => setKolDetailMonth(m)}
                                                    >
                                                        <td className="py-1.5 whitespace-nowrap">
                                                            {monthTh(m)}
                                                            {isThis && (
                                                                <span className="ml-1 text-[9px] text-sky-700">(เดือนนี้)</span>
                                                            )}
                                                        </td>
                                                        <td className="text-right tabular-nums">
                                                            {row ? numFmt(row.posts) : "—"}
                                                        </td>
                                                        <td className="text-right tabular-nums">
                                                            {row && row.barterPosts > 0 ? numFmt(row.barterPosts) : "—"}
                                                        </td>
                                                        <td className="text-right tabular-nums">
                                                            {row && row.cashBudget > 0 ? thb(row.cashBudget) : "—"}
                                                        </td>
                                                        <td className="text-right tabular-nums">
                                                            {row && row.views > 0 ? numFmt(row.views) : "—"}
                                                        </td>
                                                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                            {fcIdx >= 0 ? (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={kolDialogParams.kolMonths[fcIdx]}
                                                                    onChange={(e) => {
                                                                        const arr = [...kolDialogParams.kolMonths]
                                                                        arr[fcIdx] = e.target.checked
                                                                        setP(kolDialogGroup.name, { kolMonths: arr })
                                                                    }}
                                                                    className="accent-amber-500"
                                                                    title={`ใส่ KOL lift ในพยากรณ์ ${FORECAST_TH[fcIdx]}`}
                                                                />
                                                            ) : (
                                                                <span className="text-slate-300">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            {(() => {
                                const detailMonth = kolDetailMonth ?? kolThisMonth
                                const posts = (kolDialogGroup.kolPosts ?? []).filter((p) => p.month === detailMonth)
                                return (
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold" style={{ color: BRAND }}>
                                            รายละเอียดโพสต์ — {monthTh(detailMonth)}
                                            <span className="ml-2 text-xs font-normal text-slate-500">
                                                {posts.length} รายการ · คลิกแถวเดือนด้านบนเพื่อเปลี่ยน
                                            </span>
                                        </p>
                                        {posts.length === 0 ? (
                                            <p className="text-sm text-slate-400 py-3 text-center border rounded-md">
                                                ไม่มีโพสต์ KOL ในเดือนนี้
                                            </p>
                                        ) : (
                                            <div className="overflow-x-auto border rounded-md">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b bg-slate-50 text-slate-500">
                                                            <th className="text-left py-1.5 px-2">วันที่</th>
                                                            <th className="text-left px-2">KOL name</th>
                                                            <th className="text-left px-2">Channel</th>
                                                            <th className="text-left px-2">Link</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {posts.map((post, i) => (
                                                            <tr key={`${post.date}-${post.kolName}-${i}`} className="border-b last:border-0">
                                                                <td className="py-1.5 px-2 whitespace-nowrap tabular-nums text-slate-600">
                                                                    {post.date}
                                                                </td>
                                                                <td className="px-2 font-medium max-w-[160px] truncate" title={post.kolName}>
                                                                    {post.kolName || "—"}
                                                                </td>
                                                                <td className="px-2 whitespace-nowrap">
                                                                    {post.channel || "—"}
                                                                </td>
                                                                <td className="px-2 max-w-[220px]">
                                                                    {post.link ? (
                                                                        <a
                                                                            href={post.link}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-sky-700 underline truncate block"
                                                                            title={post.link}
                                                                        >
                                                                            {post.link.replace(/^https?:\/\//, "").slice(0, 48)}
                                                                            {post.link.replace(/^https?:\/\//, "").length > 48 ? "…" : ""}
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-slate-400">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            <p className="text-[11px] text-slate-400">
                                แผนยิงใช้กับพยากรณ์เท่านั้น (× KOL lift% จากสไลเดอร์พอร์ต) · ไม่เปลี่ยนข้อมูลจริงในชีต
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── TAB: stock ── */}
            {tab === "stock" && (
                <div className="rounded-lg border bg-white p-4 overflow-x-auto">
                    <p className="text-sm font-semibold mb-1" style={{ color: BRAND }}>
                        สต็อก & แผนสั่งซื้อ — รายเดือน (พยากรณ์ + Stock_AT + COGS จาก po_costs)
                    </p>
                    <p className="text-[11px] text-slate-500 mb-2">
                        เริ่มจากสต็อกปัจจุบัน + ระหว่างทาง · แต่ละเดือน: พยากรณ์ / สั่ง (ถ้ายอดไม่พอ) / คงเหลือท้ายเดือน ·
                        สั่งเดือนนั้น = max(พยากรณ์ − สต็อกต้นเดือน, 0) · งบ = สั่ง × COGS ·
                        (แผนรอบถัดไปแบบ ROP ยังดูที่คอลัมน์ Action ในแท็บภาพรวม)
                    </p>
                    <table className="w-full text-xs min-w-[1200px]">
                        <thead>
                            <tr className="border-b text-slate-500">
                                <th className="text-left py-1.5" rowSpan={2}>สินค้า</th>
                                <th className="text-right" rowSpan={2}>สต็อกเริ่ม</th>
                                {FORECAST_TH.map((m) => (
                                    <th key={m} className="text-center border-l px-1" colSpan={3}>
                                        {m}
                                    </th>
                                ))}
                                <th className="text-right border-l" rowSpan={2}>รวมสั่ง (ชิ้น)</th>
                                <th className="text-right" rowSpan={2}>งบสั่งรวม</th>
                            </tr>
                            <tr className="border-b text-slate-400 text-[10px]">
                                {FORECAST_TH.map((m) => (
                                    <Fragment key={m}>
                                        <th className="text-right border-l font-normal">พยากรณ์</th>
                                        <th className="text-right font-normal">สั่ง</th>
                                        <th className="text-right font-normal">เหลือ</th>
                                    </Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {computed.map((c) => {
                                const totalOrder = c.monthPlan.reduce((s, m) => s + m.orderQty, 0)
                                const totalBudget = c.monthPlan.reduce((s, m) => s + m.orderBudget, 0)
                                return (
                                    <tr key={c.g.name} className="border-b last:border-0 hover:bg-slate-50 align-top">
                                        <td className="py-1.5 font-medium whitespace-nowrap max-w-[150px] truncate">
                                            {c.g.name}
                                            {c.p.gate === 0 && (
                                                <span className="ml-1 text-[10px] text-red-600">(Gate 0)</span>
                                            )}
                                        </td>
                                        <td className="text-right tabular-nums">
                                            {numFmt(c.available)}
                                            {c.g.inTransitStock > 0 && (
                                                <div className="text-[9px] text-slate-400">
                                                    ของจริง {numFmt(c.g.currentStock)} +ทาง {numFmt(c.g.inTransitStock)}
                                                </div>
                                            )}
                                        </td>
                                        {c.monthPlan.map((m) => (
                                            <Fragment key={m.month}>
                                                <td className="text-right tabular-nums border-l text-sky-800">
                                                    {numFmt(m.demand, 0)}
                                                </td>
                                                <td className={`text-right tabular-nums ${m.orderQty > 0 ? "text-orange-700 font-semibold" : "text-slate-300"}`}>
                                                    {m.orderQty > 0 ? numFmt(Math.ceil(m.orderQty)) : "—"}
                                                </td>
                                                <td className={`text-right tabular-nums ${m.closing <= 0 && m.demand > 0 ? "text-red-600" : "text-slate-600"}`}>
                                                    {numFmt(Math.max(0, m.closing), 0)}
                                                </td>
                                            </Fragment>
                                        ))}
                                        <td className={`text-right tabular-nums border-l font-semibold ${totalOrder > 0 ? "text-orange-700" : "text-slate-400"}`}>
                                            {totalOrder > 0 ? numFmt(Math.ceil(totalOrder)) : "0"}
                                        </td>
                                        <td className={`text-right tabular-nums ${totalBudget > 0 ? "text-orange-700 font-semibold" : "text-slate-400"}`}>
                                            {totalBudget > 0
                                                ? thb(totalBudget)
                                                : totalOrder > 0
                                                  ? "ไม่มี COGS"
                                                  : "—"}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="font-semibold border-t bg-slate-50">
                                <td className="py-1.5">รวมพอร์ต</td>
                                <td className="text-right tabular-nums">
                                    {numFmt(computed.reduce((s, c) => s + c.available, 0))}
                                </td>
                                {FORECAST_MONTHS.map((_, i) => {
                                    const dem = computed.reduce((s, c) => s + c.monthPlan[i].demand, 0)
                                    const ord = computed.reduce((s, c) => s + c.monthPlan[i].orderQty, 0)
                                    const left = computed.reduce((s, c) => s + Math.max(0, c.monthPlan[i].closing), 0)
                                    return (
                                        <Fragment key={FORECAST_MONTHS[i]}>
                                            <td className="text-right tabular-nums border-l text-sky-800">
                                                {numFmt(dem, 0)}
                                            </td>
                                            <td className={`text-right tabular-nums ${ord > 0 ? "text-orange-700" : "text-slate-400"}`}>
                                                {ord > 0 ? numFmt(Math.ceil(ord)) : "—"}
                                            </td>
                                            <td className="text-right tabular-nums text-slate-600">
                                                {numFmt(left, 0)}
                                            </td>
                                        </Fragment>
                                    )
                                })}
                                <td className="text-right tabular-nums border-l text-orange-700">
                                    {numFmt(
                                        Math.ceil(computed.reduce((s, c) => s + c.monthPlan.reduce((a, m) => a + m.orderQty, 0), 0)),
                                    )}
                                </td>
                                <td className="text-right tabular-nums text-orange-700">
                                    {thb(
                                        computed.reduce(
                                            (s, c) => s + c.monthPlan.reduce((a, m) => a + m.orderBudget, 0),
                                            0,
                                        ),
                                    )}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                    <p className="text-[11px] text-slate-400 mt-2">
                        ตัวเลข &quot;สั่ง&quot; ในแต่ละเดือน = ของที่ต้องเติมให้พอขายเดือนนั้น (สมมติของเข้าทันในเดือน) ·
                        รวมสั่งทั้งช่วง ≈ งบขาด ส.ค.–ธ.ค. · สั่งเฉพาะเดือนรอบปัจจุบันดูคอลัมน์ Action ในแท็บภาพรวม
                    </p>
                </div>
            )}

            {/* ── TAB: KOL ── */}
            {tab === "kol" && (
                <div className="space-y-4">
                    {totalKolPosts < 8 && (
                        <div className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                            ⚠️ ข้อมูลโพสต์รวม {totalKolPosts} แคมเปญ (&lt; 8) — ยังไม่พอตั้งค่าสัมประสิทธิ์ KOL lift
                        </div>
                    )}
                    <div className="rounded-lg border bg-white p-4 overflow-x-auto">
                        <p className="text-sm font-semibold mb-1" style={{ color: BRAND }}>
                            KOL ต่อสินค้า (จากชีต KOL) — เรียงตาม lift ที่วัดได้จริง
                        </p>
                        <p className="text-[11px] text-slate-500 mb-2">
                            lift = ยอดขายเฉลี่ยเดือนที่มีโพสต์ ÷ เดือนที่ไม่มีโพสต์ (จากยอดจริง) ·
                            ยอดวิวปี 2026 ส่วนใหญ่ยังว่าง → ใช้จำนวนโพสต์เป็นหลัก
                        </p>
                        <table className="w-full text-xs min-w-[760px]">
                            <thead>
                                <tr className="border-b text-slate-500">
                                    <th className="text-left py-1.5">สินค้า</th>
                                    <th className="text-right">โพสต์รวม</th>
                                    <th className="text-right">Barter</th>
                                    <th className="text-right">งบเงินสดรวม</th>
                                    <th className="text-right">ยอดวิวรวม</th>
                                    <th className="text-right">lift จริง (เท่า)</th>
                                    <th className="text-left">อ่านผล</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...computed]
                                    .filter((c) => c.kolTotalPosts > 0)
                                    .sort((a, b) => (b.liftRatio ?? -1) - (a.liftRatio ?? -1))
                                    .map((c) => (
                                        <tr key={c.g.name} className="border-b last:border-0 hover:bg-slate-50">
                                            <td className="py-1.5 font-medium whitespace-nowrap max-w-[180px] truncate">{c.g.name}</td>
                                            <td className="text-right tabular-nums font-medium">{c.kolTotalPosts}</td>
                                            <td className="text-right tabular-nums">{c.kolBarter}</td>
                                            <td className="text-right tabular-nums">{c.kolCash > 0 ? thb(c.kolCash) : "—"}</td>
                                            <td className="text-right tabular-nums">{c.kolViews > 0 ? numFmt(c.kolViews) : "—"}</td>
                                            <td className={`text-right tabular-nums font-semibold ${
                                                c.liftRatio == null ? "text-slate-400" : c.liftRatio > 1 ? "text-emerald-600" : "text-red-600"
                                            }`}>
                                                {c.liftRatio != null ? `${c.liftRatio.toFixed(2)}x` : "—"}
                                            </td>
                                            <td>
                                                {c.liftRatio == null ? (
                                                    <span className="text-slate-400">ข้อมูลไม่พอเทียบ</span>
                                                ) : c.liftRatio > 1.2 ? (
                                                    <span className="text-emerald-700">✅ KOL ได้ผล — เดือนที่โพสต์ขายดีกว่าชัดเจน</span>
                                                ) : c.liftRatio > 1 ? (
                                                    <span className="text-emerald-600">ดีขึ้นเล็กน้อย</span>
                                                ) : (
                                                    <span className="text-red-600">เดือนที่โพสต์ไม่ได้ขายดีกว่า</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                        {computed.every((c) => c.kolTotalPosts === 0) && (
                            <p className="text-sm text-slate-400 py-4 text-center">ไม่มีโพสต์ KOL สำหรับสินค้ากลุ่มนี้ในชีต</p>
                        )}
                    </div>
                </div>
            )}

            <p className="text-[11px] text-slate-400 text-center pb-4">
                ข้อมูลจริงทั้งหมดอ่านจาก Google Sheet (sales_orders / KOL / Stock_AT / po_costs) ณ{" "}
                {new Date(data.loadedAt).toLocaleString("th-TH")} · cache 30 นาที ·
                พยากรณ์คำนวณสดในเบราว์เซอร์ ไม่บันทึกอัตโนมัติ — ใช้ &quot;บันทึก Scenario&quot; เพื่อเทียบ
            </p>
        </div>
    )
}
