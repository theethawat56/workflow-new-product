export type Cohort = "NEW_2026" | "NEW_2025" | "CORE"
export type Seasonality = "SEASONAL (summer)" | "YEAR-ROUND"
export type StockStatus = "REORDER NOW" | "WATCH" | "OK" | "UNKNOWN"
export type Verdict = "SCALE" | "KEEP" | "WATCH" | "FIX" | "PHASE_OUT"

export interface SalesOrderRow {
    row_id: string
    order_id: number
    order_number: string
    order_date: string
    success_date: string
    status: string
    payment_status: string
    channel_raw: string
    marketplace_name: string
    integration_name: string
    sku: string
    product_name: string
    is_bundle: number
    quantity: number
    unit_price: number
    unit_price_pretax: number
    line_total: number
    line_total_pretax: number
    line_discount: number
    synced_at: string
}

export interface PoCostRow {
    sku: string
    product_name: string
    total_qty: number
    total_value_pretax: number
    weighted_avg_cost: number
    latest_po_date: string
    earliest_po_date: string
    po_count: number
    synced_at: string
}

export interface JoinedRow extends SalesOrderRow {
    unit_cost: number | null
    cohort: Cohort
}

export interface SkuWindowMetrics {
    sku: string
    productName: string
    cohort: Cohort
    seasonality: Seasonality
    units: number
    revenue: number
    unitCost: number | null
    avgSellPrice: number | null
    grossMarginPct: number | null
    isLoss: boolean
}

export interface StockSkuMetrics {
    sku: string
    productName: string
    cohort: Cohort
    /** Launch year from cohort list or launched_products (2025 / 2026 only) */
    launchYear: 2025 | 2026 | null
    seasonality: Seasonality
    dailyAvg: number
    dailyStd: number
    dailyUnits90: number[]
    safetyStock: number
    reorderPoint: number
    minOrderQty: number
    units90d: number
    /** Current Stock from Stock_AT sheet (null if SKU not found) */
    currentStock: number | null
}

export interface SkuPeriodKpis {
    revenue: number
    units: number
    avgSellPrice: number | null
    grossMarginPct: number | null
    grossProfit: number
    orders: number
}

export interface SkuYoYDelta {
    revenuePct: number | null
    unitsPct: number | null
    grossMarginPctDelta: number | null
    grossProfitPct: number | null
    hasPriorYear: boolean
}

export interface MonthlyTrendPoint {
    month: string
    units: number
    revenue: number
    unitsMa3: number | null
    isFirstSale: boolean
}

export type ChannelGroup =
    | "Marketplace"
    | "LINE"
    | "POS"
    | "Dealer-Wholesale"
    | "WFM"

export interface ChannelGroupMetrics {
    group: ChannelGroup
    revenue: number
    share: number
    gmPct: number | null
}

export interface MonthlyGpPricePoint {
    month: string
    revenue: number
    units: number
    grossProfit: number
    gmPct: number | null
    avgSellPrice: number | null
}

export interface ProductStockPanel {
    dailyAvg30: number
    dailyAvg60: number
    dailyAvg90: number
    dailyStd: number
    velocityAccelerating: boolean
    ropDailyAvg: number
    safetyStock: number
    reorderPoint: number
    minOrderQty: number
    currentStock: number | null
    coverDays: number | null
    status: StockStatus
}

export interface ProductDeepDiveData {
    sku: string
    productName: string
    cohort: Cohort
    seasonality: Seasonality
    dataAsOf: string
    ytd2026From: string
    ytd2026To: string
    ytd2025From: string
    ytd2025To: string
    verdict: Verdict
    verdictReason: string
    actions: string[]
    medianUnits: number
    ytd2026: SkuPeriodKpis
    ytd2025: SkuPeriodKpis | null
    ytdDelta: SkuYoYDelta
    monthlyTrend: MonthlyTrendPoint[]
    firstSaleMonth: string | null
    channelBreakdown: ChannelGroupMetrics[]
    channelInsight: string
    stock: ProductStockPanel
}

export interface AnalyticsOverview {
    dataAsOf: string
    ytdCutoff: string
    ytd2026From: string
    ytd2026To: string
    ytd2025From: string
    ytd2025To: string
    totalRevYtd2026: number
    totalRevYtd2025: number
    revYoYPct: number
    newProductSharePct: number
    newProductShareTargetLow: number
    newProductShareTargetHigh: number
    totalGrossMarginPct: number
    totalGrossMarginPct2025: number
    totalGrossProfitYtd2026: number
    totalGrossProfitYtd2025: number
    gpYoYPct: number | null
    gpMarginDeltaPp: number | null
    new2026Rev: number
    new2025Rev: number
    coreRev: number
    gapToTargetLow: number
    gapToTargetHigh: number
    missingCostSkus: string[]
    topGainers: Array<{ sku: string; productName: string; delta: number }>
    topDecliners: Array<{ sku: string; productName: string; delta: number }>
    skuMetricsYtd: SkuWindowMetrics[]
    stockSkus: StockSkuMetrics[]
    monthlyGpPrice: MonthlyGpPricePoint[]
    joinedRowCount: number
}
