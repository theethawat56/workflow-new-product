import { format, subMonths } from "date-fns"

export type ProductTier = "ถูก" | "กลาง" | "สูง" | "พรีเมียม"
export type LaunchVerdict =
    | "ON-TRACK"
    | "BEHIND"
    | "STOCK-RISK"
    | "MARGIN-FAIL"
    | "OVER-SEEDING"

export type LaunchAlertType =
    | "STOCK-RISK"
    | "OVER-SEEDING"
    | "BUDGET-OVER"
    | "MARGIN-FAIL"
    | "SWITCH-TO-PAID"

export const GP_TARGET_PCT = 30
export const SALES_TARGET_M2_LOW = 300_000
export const SALES_TARGET_M2_HIGH = 500_000
export const SALES_TARGET_M3_PLUS = 500_000
export const MKTG_TARGET_LAUNCH_LOW = 10
export const MKTG_TARGET_LAUNCH_HIGH = 12
export const MKTG_TARGET_STEADY_LOW = 2
export const MKTG_TARGET_STEADY_HIGH = 3
export const SEED_CAP_LOW = 35
export const SEED_CAP_HIGH = 40
export const DEFAULT_LEAD_TIME_DAYS = 45
export const RUN_RATE_HIT = 300_000

export function tierFromAsp(asp: number): ProductTier {
    if (asp < 1500) return "ถูก"
    if (asp < 4000) return "กลาง"
    if (asp < 8000) return "สูง"
    return "พรีเมียม"
}

export function salesTargetForMonth(monthIndex: number): { low: number; high: number } {
    if (monthIndex <= 1) return { low: 0, high: SALES_TARGET_M2_LOW }
    if (monthIndex === 2) return { low: SALES_TARGET_M2_LOW, high: SALES_TARGET_M2_HIGH }
    return { low: SALES_TARGET_M3_PLUS, high: SALES_TARGET_M3_PLUS * 1.5 }
}

export function mktgTargetPct(runRate: number, monthIndex: number): number {
    if (runRate >= RUN_RATE_HIT || monthIndex >= 3) {
        return (MKTG_TARGET_STEADY_LOW + MKTG_TARGET_STEADY_HIGH) / 2
    }
    return (MKTG_TARGET_LAUNCH_LOW + MKTG_TARGET_LAUNCH_HIGH) / 2
}

export const TIER_KOL_TARGETS: Record<
    ProductTier,
    { unitsAt300k: number; seed: number; barterPosts: number; paidPosts: number }
> = {
    ถูก: { unitsAt300k: 250, seed: 45, barterPosts: 40, paidPosts: 5 },
    กลาง: { unitsAt300k: 120, seed: 18, barterPosts: 25, paidPosts: 5 },
    สูง: { unitsAt300k: 50, seed: 8, barterPosts: 12, paidPosts: 12 },
    พรีเมียม: { unitsAt300k: 25, seed: 3, barterPosts: 3, paidPosts: 12 },
}

export const VERDICT_PRIORITY: Record<LaunchVerdict, number> = {
    "STOCK-RISK": 0,
    "MARGIN-FAIL": 1,
    "OVER-SEEDING": 2,
    BEHIND: 3,
    "ON-TRACK": 4,
}

export const ALERT_PRIORITY: Record<LaunchAlertType, number> = {
    "STOCK-RISK": 0,
    "MARGIN-FAIL": 1,
    "OVER-SEEDING": 2,
    "BUDGET-OVER": 3,
    "SWITCH-TO-PAID": 4,
}

export type CellStatus = "hit" | "near" | "miss" | "na"

export type RunRateSource = "prev_month" | "current_mtd" | "last_30d" | "none"

export interface RunRateResult {
    value: number
    source: RunRateSource
    sourceMonth?: string
}

/** Run-rate = previous calendar month revenue, else current MTD, else last 30 days (per spec). */
export function computeRunRate(
    monthlyRevenue: Map<string, number>,
    last30DayRevenue: number,
    asOf: Date = new Date(),
): RunRateResult {
    const currentMonth = format(asOf, "yyyy-MM")
    const prevMonth = format(subMonths(asOf, 1), "yyyy-MM")

    const prevRev = monthlyRevenue.get(prevMonth) ?? 0
    if (prevRev > 0) {
        return { value: prevRev, source: "prev_month", sourceMonth: prevMonth }
    }

    const mtd = monthlyRevenue.get(currentMonth) ?? 0
    if (mtd > 0) {
        return { value: mtd, source: "current_mtd", sourceMonth: currentMonth }
    }

    if (last30DayRevenue > 0) {
        return { value: last30DayRevenue, source: "last_30d" }
    }

    return { value: 0, source: "none" }
}

export function runRateStatus(runRate: number, monthIndex: number): CellStatus {
    if (runRate <= 0) return "na"
    const mi = Math.max(monthIndex, 1)
    const target = salesTargetForMonth(mi)

    if (mi <= 1) {
        if (runRate >= SALES_TARGET_M2_LOW) return "hit"
        if (runRate >= SALES_TARGET_M2_LOW * 0.5) return "near"
        return "miss"
    }
    if (runRate >= target.low) return "hit"
    if (runRate >= target.low * 0.75) return "near"
    return "miss"
}

/** Progress % toward a specific revenue goal (100% = hit goal). */
export function runRateProgressPctWithGoal(runRate: number, goal: number): number {
    if (runRate <= 0 || goal <= 0) return 0
    return Math.min(100, (runRate / goal) * 100)
}

/** Progress % toward milestone minimum (100% = hit target.low for that month index). */
export function runRateProgressPct(runRate: number, monthIndex: number): number {
    return runRateProgressPctWithGoal(runRate, runRateProgressGoal(monthIndex))
}

export function runRateProgressGoal(monthIndex: number): number {
    const mi = Math.max(monthIndex, 1)
    const target = salesTargetForMonth(mi)
    if (mi <= 1) return SALES_TARGET_M2_LOW
    return target.low > 0 ? target.low : SALES_TARGET_M2_LOW
}

export function runRateStatusWithGoal(runRate: number, goal: number): CellStatus {
    if (runRate <= 0) return "na"
    if (goal <= 0) return "na"
    if (runRate >= goal) return "hit"
    if (runRate >= goal * 0.75) return "near"
    return "miss"
}

export function marginStatus(netMarginPct: number): CellStatus {
    if (netMarginPct <= 0) return "na"
    if (netMarginPct >= GP_TARGET_PCT) return "hit"
    if (netMarginPct >= GP_TARGET_PCT * 0.85) return "near"
    return "miss"
}

export function mktgStatus(mktgPct: number | null, target: number): CellStatus {
    if (mktgPct == null) return "na"
    if (mktgPct <= target * 1.1) return "hit"
    if (mktgPct <= target * 1.25) return "near"
    return "miss"
}
