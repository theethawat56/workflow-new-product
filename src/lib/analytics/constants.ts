import type { Cohort, StockStatus } from "./types"

export const YTD_CUTOFF_SUFFIX = "06-09"

const NEW_2026_LIST = [
    "ATB092116", "ATB092105", "ATB092115", "ATB092123", "ATB092128", "ATB092037",
    "ATB092129", "ATB092139", "ATB092125", "ATB092141", "ATB092121", "ATB92119",
    "ATB092119", "ATB092127", "ATB092135", "ATB092117", "ATB092124", "ATB092114",
    "ATB092138", "ATB092113", "ATB092134", "ATB092133", "ATB092137", "ATB092140",
] as const

const NEW_2025_LIST = [
    "ATB092068", "ATB092100", "ATB092082", "ATB092112", "ATB092088", "ATB092081",
    "ATB092101", "ATB092107", "ATB092087", "ATB092080", "ATB092089", "ATB092086",
    "ATB092090", "ATB092083", "ATB092106", "ATB092111", "ATB092126", "ATB092069",
    "ATB92117", "ATB092117", "ATB092099", "ATB092096", "ATB092065",
] as const

export const NEW_2026_SKUS = new Set(NEW_2026_LIST.map((s) => s.toUpperCase()))
export const NEW_2025_SKUS = new Set(NEW_2025_LIST.map((s) => s.toUpperCase()))

export const CORE_WINNER_SEEDS = [
    "ATB092060", "ATB092063", "EU0006", "ATB092085", "ATB092068", "ATB092100",
] as const

export const VALID_STATUSES = new Set(["Success", "Pending", "Waiting"])
export const DEFAULT_LEAD_TIME = 45
export const Z_BY_SERVICE: Record<number, number> = { 90: 1.28, 95: 1.65, 99: 2.33 }
export const GM_SCALE_THRESHOLD = 55
export const GM_KEEP_THRESHOLD = 35
export const VELOCITY_ACCEL_RATIO = 1.5

export function getCohort(sku: string): Cohort {
    const s = sku.trim().toUpperCase()
    if (NEW_2026_SKUS.has(s)) return "NEW_2026"
    if (NEW_2025_SKUS.has(s)) return "NEW_2025"
    return "CORE"
}

export interface LaunchRef {
    launch_date?: string
    launch_type?: string
}

/** Resolve 2025/2026 launch year from cohort lists or launched_products. */
export function resolveLaunchYear(
    sku: string,
    cohort: Cohort,
    launchedBySku: Map<string, LaunchRef>,
): 2025 | 2026 | null {
    if (cohort === "NEW_2026") return 2026
    if (cohort === "NEW_2025") return 2025

    const lp = launchedBySku.get(sku.trim().toUpperCase())
    if (!lp || lp.launch_type === "EXISTING_ADDITION") return null
    const y = parseInt(String(lp.launch_date ?? "").slice(0, 4), 10)
    if (y === 2025 || y === 2026) return y
    return null
}

export function stockStatus(
    currentStock: number | null,
    rop: number,
): StockStatus {
    if (currentStock == null || Number.isNaN(currentStock)) return "UNKNOWN"
    if (currentStock <= rop) return "REORDER NOW"
    if (currentStock <= rop * 1.3) return "WATCH"
    return "OK"
}
