import { z } from "zod"

// --- Enums ---
export const ChannelSchema = z.enum(["TikTok", "Instagram", "YouTube", "Other"])
export type Channel = z.infer<typeof ChannelSchema>

export const BudgetTypeSchema = z.enum([
    "CASH",
    "PRODUCT_BARTER",
    "AFFILIATE_BARTER",
    "BOTH",
    "UNKNOWN"
])
export type BudgetType = z.infer<typeof BudgetTypeSchema>

// --- Raw Row Schemas (Sheet Headers) ---
// Flexible validation for sheet inputs
export const RawKolRowSchema = z.object({
    "PIC": z.string().optional(),
    "Post Date": z.string().optional(),
    "D": z.string().optional(),
    "M": z.string().optional(),
    "Y": z.string().optional(),
    "Count unique": z.string().optional(),
    "KOL Name": z.string().optional(),
    "Product Name": z.string().optional(),
    "SKU": z.string().optional(),
    "Channel": z.string().optional(),
    "Budget type": z.string().optional(),
    "Budget amount": z.string().optional(),
    "Budget product": z.string().optional(),
    "Budget Final": z.string().optional(),
    "KOL Type": z.string().optional(),
    "Asset Link (drive)": z.string().optional(),
    "Code": z.string().optional(),
    "Link": z.string().optional(),
    "Follower": z.string().optional(),
    "Viewed": z.string().optional(),
    "Saved": z.string().optional(),
    "Liked": z.string().optional(),
    "Shared": z.string().optional(),
    "Status": z.string().optional(),
    "View >1m": z.string().optional(),
    "taskNumber": z.string().optional(),
}).catchall(z.any())

export const RawSalesRowSchema = z.object({
    "Date": z.string().optional(),
    "SKU": z.string().optional(),
    "Revenue": z.string().optional(),
    "Units Sold": z.string().optional(),
    "Product Name": z.string().optional(),
}).catchall(z.any())

// --- Normalized Domain Models ---

export const KolRowSchema = z.object({
    id: z.string(),
    postDate: z.string(), // YYYY-MM-DD
    pic: z.string(),
    kolName: z.string(),
    channel: ChannelSchema,
    sku: z.string(),
    budgetAmount: z.number(),
    productName: z.string(),
    viewed: z.number(),
    link: z.string().optional(),
})
export type KolRow = z.infer<typeof KolRowSchema>

export const SalesRowSchema = z.object({
    id: z.string(),
    date: z.string(), // YYYY-MM-DD
    sku: z.string(),
    revenue: z.number(),
    unitsSold: z.number(),
    productName: z.string().optional(),
})
export type SalesRow = z.infer<typeof SalesRowSchema>

// --- Dashboard Structures ---

export type DateRange = {
    from: string; // YYYY-MM-DD
    to: string;   // YYYY-MM-DD
}

export type DashboardMode = "PERIOD" | "ATTRIBUTION"

export interface DashboardFilters {
    dateRange: DateRange
    selectedSkus: string[]
    selectedPics: string[]
    selectedChannels: string[]
    mode: DashboardMode
    attributionWindow: number // Days
}

export interface KpiMetrics {
    totalRevenue: number
    totalBudget: number
    totalCost: number
    totalCostPct: number | null
    totalPosts: number
    totalUniqueKols: number

    // Attribution specifics
    attributedRevenue?: number
    attributedCostPct?: number | null
}

export interface SkuImpactRow {
    sku: string
    productName: string
    revenue: number
    budget: number
    costPct: number | null
    posts: number
    uniqueKols: number
    views: number

    // Attribution
    attributedRevenue?: number
    attributedCostPct?: number | null

    // Trend
    costPctTrendSeries: (number | null)[]
    costPctTrendLast: number | null
    costPctTrendDeltaPP: number | null
    costPctTrendDirection: "UP" | "DOWN" | "FLAT" | "NA"
}

export interface TimeSeriesPoint {
    date: string // YYYY-MM-DD
    revenue: number
    budget: number
    costPct: number | null
    posts: number
}

export interface PostDetailRow {
    postDate: string
    pic: string
    kolName: string
    channel: string
    budget: number
    viewed: number
    link?: string
    revenueShare?: number // For attribution mode debugging
}

export interface DataQualityIssue {
    type: "MISSING_SKU" | "MISSING_PRODUCT_NAME" | "INVALID_DATE" | "INVALID_NUMBER" | "KOL_SKU_NOT_FOUND_IN_SALES"
    count: number
    samples: string[]
}

export interface DashboardDataV2 {
    kpis: KpiMetrics
    skuTable: SkuImpactRow[]
    timeSeries: TimeSeriesPoint[]
    dataQuality: DataQualityIssue[]
    trendBuckets: string[] // Labels for sparkline tooltips

    // For Filter Options
    filterOptions: {
        products: { sku: string; productName: string }[]
        pics: string[]
        channels: string[]
    }
}
