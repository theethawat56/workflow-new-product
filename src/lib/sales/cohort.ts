/**
 * Cohort & main-SKU helpers shared by the sales and cohort-growth dashboards.
 *
 * "Main SKU" rule:
 *   A SKU is considered a *main / branded* product when it starts with one of
 *   the recognised brand prefixes (`ATB` = Autobot, `EU` / `E00` = Eureka).
 *   Everything else (`ACC*`, `CTB*`, marketplace bundles, accessories,
 *   service/claim entries, etc.) is excluded.
 */

export const MAIN_SKU_PREFIXES = ["ATB", "EU", "E00"] as const

export function isMainSku(sku: string | undefined | null): boolean {
    if (!sku) return false
    const trimmed = sku.trim().toUpperCase()
    return MAIN_SKU_PREFIXES.some((p) => trimmed.startsWith(p))
}

export const COHORT_2025_SKUS: readonly string[] = [
    "ATB092065",
    "ATB092066",
    "ATB092067",
    "ATB092068",
    "ATB092069",
    "ATB092080",
    "ATB092081",
    "ATB092082",
    "ATB092083",
    "ATB092086",
    "ATB092087",
    "ATB092089",
    "ATB092090",
    "ATB092094",
    "ATB092095",
    "ATB092096",
    "ATB092097",
    "ATB092098",
] as const

export const COHORT_2025_SKU_SET = new Set<string>(COHORT_2025_SKUS)

export interface LaunchedProductRow {
    zort_sku: string
    launch_date: string
    product_name: string
    status: string
    launch_type?: string
}

/**
 * Same "new product" rule as the Sales dashboard:
 * - NEW_LAUNCH in launched_products → new
 * - EXISTING_ADDITION → catalog (not new)
 * - otherwise → go_live_date in the given year
 */
export function isNewLaunchProduct(
    goLiveDate: string | undefined | null,
    launchedInfo: Pick<LaunchedProductRow, "launch_type"> | undefined | null,
    year: number = new Date().getFullYear(),
): boolean {
    const launchDate = goLiveDate ? new Date(goLiveDate) : null
    const launchYear =
        launchDate && !isNaN(launchDate.getTime()) ? launchDate.getFullYear() : null

    if (launchedInfo) {
        if (launchedInfo.launch_type === "NEW_LAUNCH") return true
        if (launchedInfo.launch_type === "EXISTING_ADDITION") return false
        return launchYear === year
    }
    return launchYear === year
}

export function getNewLaunchSkusForYear(
    launchedProducts: LaunchedProductRow[],
    year: number,
): string[] {
    const y = String(year)
    return launchedProducts
        .filter(
            (lp) =>
                lp.launch_type === "NEW_LAUNCH" &&
                (lp.launch_date ?? "").startsWith(y) &&
                lp.zort_sku,
        )
        .map((lp) => lp.zort_sku.trim())
        .sort()
}

export function buildCohort2026SkuSet(launchedProducts: LaunchedProductRow[]): Set<string> {
    return new Set(getNewLaunchSkusForYear(launchedProducts, new Date().getFullYear()))
}

export interface ProductGoLiveRow {
    sku_code: string
    go_live_date?: string
}

/**
 * SKUs classified as "new launch" for a given year — same rule as the Sales dashboard
 * (`isNewLaunchProduct` on `launched_products` + `products.go_live_date`).
 */
export function buildNewLaunchSkuSetForYear(
    launchedProducts: LaunchedProductRow[],
    products: ProductGoLiveRow[],
    year: number = new Date().getFullYear(),
): Set<string> {
    const launchedMap = new Map<string, LaunchedProductRow>()
    for (const lp of launchedProducts) {
        const sku = lp.zort_sku.trim().toUpperCase()
        if (sku) launchedMap.set(sku, lp)
    }

    const productGoLive = new Map<string, string | undefined>()
    for (const p of products) {
        const sku = p.sku_code.trim().toUpperCase()
        if (sku) productGoLive.set(sku, p.go_live_date)
    }

    const skus = new Set<string>()
    const allSkus = new Set([...launchedMap.keys(), ...productGoLive.keys()])

    for (const sku of allSkus) {
        if (isNewLaunchProduct(productGoLive.get(sku), launchedMap.get(sku), year)) {
            skus.add(sku)
        }
    }

    return skus
}

export function earliestLaunchDate(
    launchedProducts: LaunchedProductRow[],
    skuSet: Set<string>,
): string | null {
    const dates = launchedProducts
        .filter((lp) => skuSet.has(lp.zort_sku) && lp.launch_date)
        .map((lp) => lp.launch_date.slice(0, 10))
        .sort()
    return dates[0] ?? null
}
