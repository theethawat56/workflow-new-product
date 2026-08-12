import type { LaunchAlertType, LaunchVerdict, ProductTier, CellStatus, RunRateSource } from "./launch-constants"

export interface ProductGroupOption {
    groupId: string
    label: string
    skus: string[]
    tier: ProductTier
    asp: number
    netMarginPct: number
    verdict: LaunchVerdict
}

export interface MonthlyLaunchRow {
    monthIndex: number
    monthLabel: string
    units: number
    revenue: number
    netGp: number
    netMarginPct: number | null
    mktgCost: number
    mktgPct: number | null
    kolPosts: number
    barterPosts: number
    paidPosts: number
    runRateTarget: number
    runRateStatus: "hit" | "miss" | "na"
    stockEnd: number | null
    daysCover: number | null
}

export interface LaunchGroupDetail {
    groupId: string
    label: string
    skus: string[]
    tier: ProductTier
    asp: number
    cogs: number
    netMarginPct: number
    launchDate: string | null
    monthIndex: number
    verdict: LaunchVerdict
    alerts: LaunchAlertType[]
    alertMessages: string[]

    runRate: number
    runRateSource: RunRateSource
    runRateSourceMonth?: string
    runRateTarget: { low: number; high: number }
    gpTargetPct: number
    avgMonthlyRevenue: number
    avgMonthlyUnits: number

    salesMonthly: Array<{
        month: string
        revenue: number
        units: number
        targetLow: number
        targetHigh: number
    }>
    channelSplit: { marketplace: number; direct: number; other: number }

    currentStock: number
    daysCover: number | null
    leadTimeDays: number
    seedUnits: number
    barterUnits: number
    sellableUnits: number
    seedCapPct: number
    seedCapLimit: number
    lots: Array<{
        lotNo: string
        qtyOrdered: number
        orderDate: string
        arrivalDate: string
        sku: string
    }>

    kolMonthly: Array<{
        month: string
        mktgCost: number
        mktgPct: number | null
        mktgTarget: number
        barterPosts: number
        paidPosts: number
    }>
    cumulativeKolCost: number
    cumulativeNetGp: number
    gpPerKol: number | null
    barterRecommendation: "barter" | "paid" | "mixed"
    barterOppCostPerUnit: number

    linkSeries: Array<{
        month: string
        kolPosts: number
        revenue: number
        revenueLag1: number
    }>

    monthlyTable: MonthlyLaunchRow[]

    /** Total KOL posts (all time) — display metric for the โพสต์/เดือน column. */
    kolPostsPerMonth: number
    kolBarterPerMonth: number
    kolPaidPerMonth: number
    kolPostsMonthLabel: string
    /** Mktg cost for the run-rate period: cash budget + posts giving product × COGS. */
    mktgCostPeriod: number
    mktgPctPeriod: number | null
    mktgTargetPeriod: number
    /** Revenue of the run-rate period (denominator of mktgPctPeriod). */
    runRateMonthRev: number
}

export interface PortfolioRow {
    groupId: string
    label: string
    tier: ProductTier
    monthIndex: number
    runRate: number
    runRateStatus: CellStatus
    runRateSource: RunRateSource
    runRateSourceMonth?: string
    progressPct: number
    progressGoal: number
    defaultProgressGoal: number
    isCustomProgressGoal: boolean
    avgMonthlyRevenue: number
    avgMonthlyUnits: number
    netMarginPct: number
    marginStatus: CellStatus
    mktgPct: number | null
    mktgStatus: CellStatus
    currentStock: number
    kolPostsPerMonth: number
    kolBarterPerMonth: number
    kolPaidPerMonth: number
    kolPostsMonthLabel: string
    verdict: LaunchVerdict
    cumulativeNetGp: number
}

export interface PortfolioAlertItem {
    groupId: string
    label: string
    alertType: LaunchAlertType
    message: string
    urgency: number
}

export interface PortfolioRollup {
    verdictCounts: Record<LaunchVerdict, number>
    totalRunRate: number
    hit300kCount: number
    notHit300kCount: number
    totalMktgCost: number
    portfolioMktgPct: number
    mktgTargetPct: number
    totalNetGp: number
    avgNetMarginPct: number
    productCount: number
}

export interface ScatterPoint {
    groupId: string
    label: string
    monthIndex: number
    runRate: number
    netGp: number
    verdict: LaunchVerdict
}

export interface LaunchCommandCenterData {
    dataAsOf: string
    groups: ProductGroupOption[]
    portfolio: PortfolioRollup
    portfolioRows: PortfolioRow[]
    portfolioAlerts: PortfolioAlertItem[]
    scatterData: ScatterPoint[]
    selected: LaunchGroupDetail | null
}
