import { fetchSheet } from "@/lib/workspace/data-source"
import {
    DashboardFilters, DashboardDataV2, KolRow, SalesRow,
    DataQualityIssue, KpiMetrics, SkuImpactRow, TimeSeriesPoint,
    RawKolRowSchema, RawSalesRowSchema
} from "./types"
import { normalizeKolRow, normalizeSalesRow } from "./utils"
import {
    parseISO, isBefore, isAfter, differenceInDays, format, isValid,
    startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval
} from "date-fns"

// --- Constants ---
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
let cache: {
    data: { posts: KolRow[], sales: SalesRow[], issues: DataQualityIssue[] } | null,
    timestamp: number
} = { data: null, timestamp: 0 }

// --- Helpers ---
function getTrendBuckets(start: Date, end: Date) {
    const days = differenceInDays(end, start)
    let type: "day" | "week" | "month" = "week"
    let dates: Date[] = []

    if (days <= 21) {
        type = "day"
        dates = eachDayOfInterval({ start, end })
    } else if (days <= 90) {
        type = "week"
        dates = eachWeekOfInterval({ start, end })
    } else {
        type = "month"
        dates = eachMonthOfInterval({ start, end })
    }

    // Labels are our keys (YYYY-MM-DD)
    const labels = dates.map(d => format(d, 'yyyy-MM-dd'))
    return { type, labels }
}

function getBucketIndex(dateStr: string, bucketType: "day" | "week" | "month", labels: string[]): number {
    const date = parseISO(dateStr)
    let key = ""
    if (bucketType === 'day') key = format(date, 'yyyy-MM-dd')
    else if (bucketType === 'week') key = format(startOfWeek(date), 'yyyy-MM-dd')
    else key = format(startOfMonth(date), 'yyyy-MM-dd')

    return labels.indexOf(key)
}

// --- Data Fetching ---
async function getRawData() {
    const now = Date.now()
    if (cache.data && (now - cache.timestamp < CACHE_TTL_MS)) {
        return cache.data
    }

    const issues: DataQualityIssue[] = []
    const issueMap: Record<string, DataQualityIssue> = {
        MISSING_SKU: { type: "MISSING_SKU", count: 0, samples: [] },
        MISSING_PRODUCT_NAME: { type: "MISSING_PRODUCT_NAME", count: 0, samples: [] },
        INVALID_DATE: { type: "INVALID_DATE", count: 0, samples: [] },
        INVALID_NUMBER: { type: "INVALID_NUMBER", count: 0, samples: [] },
        KOL_SKU_NOT_FOUND_IN_SALES: { type: "KOL_SKU_NOT_FOUND_IN_SALES", count: 0, samples: [] },
    }

    const logIssue = (type: keyof typeof issueMap, sample: string) => {
        issueMap[type].count++
        if (issueMap[type].samples.length < 5) {
            issueMap[type].samples.push(sample)
        }
    }

    // Fetch in parallel
    const [rawKol, rawSales] = await Promise.all([
        fetchSheet<any>("kol").catch(e => { console.error("KOL fetch failed", e); return [] }),
        fetchSheet<any>("sales_all").catch(e => {
            console.warn("Sales_All fetch failed, trying Sale_All");
            return fetchSheet<any>("sale_all" as any).catch(e => { console.error("All sales fetch failed", e); return [] })
        })
    ])

    const posts: KolRow[] = []
    rawKol.forEach((row, i) => {
        try {
            const normalized = normalizeKolRow(i, row, []) // We'll handle issues here manually for aggregation
            if (normalized) {
                if (!normalized.productName) logIssue("MISSING_PRODUCT_NAME", `Row ${i}: ${normalized.sku}`)
                posts.push(normalized)
            } else {
                // Determine why null
                const parsed = RawKolRowSchema.parse(row)
                if (!parsed["Post Date"]) logIssue("INVALID_DATE", `Row ${i}`)
                if (!parsed["SKU"]) logIssue("MISSING_SKU", `Row ${i}`)
            }
        } catch (e) {
            console.error(`Row ${i} parsing error`, e)
        }
    })

    const sales: SalesRow[] = []
    rawSales.forEach((row, i) => {
        try {
            const normalized = normalizeSalesRow(i, row)
            if (normalized) sales.push(normalized)
        } catch (e) {
            // Sales errors
        }
    })

    // Data Quality: Check KOL SKUs against Sales SKUs
    const salesSkus = new Set(sales.map(s => s.sku))
    posts.forEach(p => {
        if (!salesSkus.has(p.sku)) {
            logIssue("KOL_SKU_NOT_FOUND_IN_SALES", `${p.sku} (KOL: ${p.kolName})`)
        }
    })

    // Consolidate Issues
    Object.values(issueMap).forEach(i => {
        if (i.count > 0) issues.push(i)
    })

    const result = { posts, sales, issues }
    cache = { data: result, timestamp: now }
    return result
}


// --- Main Service ---

export async function getKolSalesDataV2(filters: DashboardFilters): Promise<DashboardDataV2> {
    const { posts, sales, issues } = await getRawData()

    // 1. Prepare Filter Options (from ALL data)
    const allPics = Array.from(new Set(posts.map(p => p.pic))).sort()
    const allChannels = Array.from(new Set(posts.map(p => p.channel))).sort()

    // Product Map (SKU -> Name)
    // Priority: KOL Name > Sales Name > "Unknown (SKU)"
    // Logic: Find most frequent non-empty name in KOL for each SKU
    const productMap = new Map<string, string>()
    const skuNameCounts = new Map<string, Map<string, number>>()

    posts.forEach(p => {
        if (!p.productName) return
        if (!skuNameCounts.has(p.sku)) skuNameCounts.set(p.sku, new Map())
        const counts = skuNameCounts.get(p.sku)!
        counts.set(p.productName, (counts.get(p.productName) || 0) + 1)
    })

    // Resolve KOL names
    skuNameCounts.forEach((counts, sku) => {
        let bestName = ""
        let maxCount = -1
        counts.forEach((count, name) => {
            if (count > maxCount) {
                maxCount = count
                bestName = name
            }
        })
        if (bestName) productMap.set(sku, bestName)
    })

    // Fallback to Sales names
    sales.forEach(s => {
        if (!productMap.has(s.sku) && s.productName) {
            productMap.set(s.sku, s.productName)
        }
    })

    // Fill valid products list
    const validProducts = Array.from(productMap.entries())
        .map(([sku, name]) => ({ sku, productName: name }))
        .sort((a, b) => a.productName.localeCompare(b.productName))


    // 2. Apply Filters (Date & Selection)
    const fromDate = parseISO(filters.dateRange.from)
    const toDate = parseISO(filters.dateRange.to)

    // Validate Date Range
    if (!isValid(fromDate) || !isValid(toDate)) {
        return {
            kpis: {
                totalRevenue: 0, totalBudget: 0, totalCost: 0, totalCostPct: 0, totalPosts: 0, totalUniqueKols: 0
            },
            skuTable: [],
            timeSeries: [],
            dataQuality: [{ type: "INVALID_DATE", count: 1, samples: ["Invalid Date Filter"] }],
            trendBuckets: [],
            filterOptions: { products: [], pics: [], channels: [] }
        }
    }

    // Prepare Trend Buckets
    const { type: bucketType, labels: bucketLabels } = getTrendBuckets(fromDate, toDate)

    // Helper to calc trend stats
    const calculateTrend = (budgets: number[], revenues: number[]) => {
        const series = budgets.map((b, i) => {
            const r = revenues[i]
            return r > 0 ? (b / r) * 100 : null
        })

        // Find last non-null
        let last = null
        let prev = null
        for (let i = series.length - 1; i >= 0; i--) {
            if (series[i] !== null) {
                if (last === null) last = series[i]
                else {
                    prev = series[i]
                    break
                }
            }
        }

        const delta = (last !== null && prev !== null) ? last - prev : null
        let direction: "UP" | "DOWN" | "FLAT" | "NA" = "NA"
        if (delta !== null) {
            if (delta > 0.5) direction = "UP"
            else if (delta < -0.5) direction = "DOWN"
            else direction = "FLAT"
        }

        return { series, last, delta, direction }
    }

    // Helper: is in filter?
    const isSkuSelected = (sku: string) => filters.selectedSkus.length === 0 || filters.selectedSkus.includes(sku)
    const isPicSelected = (pic: string) => filters.selectedPics.length === 0 || filters.selectedPics.includes(pic)
    const isChannelSelected = (ch: string) => filters.selectedChannels.length === 0 || filters.selectedChannels.includes(ch)

    // 3. Metrics Calculation (Strategy Pattern)

    let kpis: KpiMetrics
    let skuMetrics: Map<string, SkuImpactRow>
    let timeSeriesMap: Map<string, TimeSeriesPoint>

    if (filters.mode === "ATTRIBUTION") {
        // --- Attribution Mode (Split Credit) ---
        // Filter Sales first by Date Range (Sales must happen in range)
        const relevantSales = sales.filter(s => {
            const d = parseISO(s.date)
            return isAfter(d, fromDate) && isBefore(d, toDate) || d.getTime() === fromDate.getTime() || d.getTime() === toDate.getTime() // Inclusive? Check date-fns logic carefully. Usually isWithinInterval is better but verifying manual boundary.
            // isAfter/Before are exclusive. Let's use string cmp for YYYY-MM-DD for safety or basic >= <=
            // String comparison is safe for YYYY-MM-DD
        }).filter(s => s.date >= filters.dateRange.from && s.date <= filters.dateRange.to)
            .filter(s => isSkuSelected(s.sku))

        // Initialize SKU Map
        skuMetrics = new Map()
        timeSeriesMap = new Map()

        let totalAttributedRev = 0
        let totalBudget = 0

        // For Attribution, we need to scan ALL posts (even before date range) that *could* influence these sales?
        // OR does the user filter restrict which posts get credit? 
        // Requirement: "Eligible sales dates are [postDate, postDate + window]" 
        // usually implies identifying which posts get credit for the sales in the current view.
        // But commonly users filter the *Sales* period and want to see what caused them.
        // Let's assume Filters apply to SALES dates in this mode mainly, but we need to find relevant posts.
        // However, standard dashboard behavior: Filters apply to "Activity" (Posts).
        // Let's stick to: Filters restrict the *Posts* we care about, AND the *Sales* we care about?
        // Actually, easiest mental model: 
        // 1. Filter Posts by Date/PIC/etc.
        // 2. Filter Sales by Date Range.
        // 3. Match them.

        // Let's go with: Filter Posts by Date Range (classic Period mode).
        // Attribution adds: For the *Sales* that occurred, how much is attributed to *these* posts?
        // But Split Credit requires knowing *all* competing posts. 
        // COMPLEXITY: If we filter posts, we artificially inflate credit to remaining posts if we ignore others?
        // Correct Split Credit: Find ALL matching posts for a sale day, regardless of UI filters. Split revenue. 
        // THEN, only sum up the revenue for the posts that pass the UI filters.

        // Pre-group all posts by SKU (for fast lookup)
        const allPostsBySku = new Map<string, KolRow[]>()
        posts.forEach(p => {
            const list = allPostsBySku.get(p.sku) || []
            list.push(p)
            allPostsBySku.set(p.sku, list)
        })

        // Iterate ALL sales in range
        relevantSales.forEach(sale => {
            const saleDate = parseISO(sale.date)
            const skuPosts = allPostsBySku.get(sale.sku) || []

            // Find eligible posts (Post Date <= Sale Date <= Post Date + Window)
            const eligible = skuPosts.filter(p => {
                const pDate = parseISO(p.postDate)
                const diff = differenceInDays(saleDate, pDate)
                return diff >= 0 && diff <= filters.attributionWindow
            })

            if (eligible.length > 0) {
                const revShare = sale.revenue / eligible.length

                eligible.forEach(p => {
                    // Only count if this post passes UI filters (Date, PIC, Channel)
                    // Note: Date filter here applies to *Post Date* because we are viewing "Post Performance"
                    const pDateStr = p.postDate
                    if (pDateStr >= filters.dateRange.from && pDateStr <= filters.dateRange.to &&
                        isPicSelected(p.pic) && isChannelSelected(p.channel)) {

                        // Add to Metrics
                        const sku = p.sku
                        const entry = skuMetrics.get(sku) || {
                            sku, productName: productMap.get(sku) || `Unknown (${sku})`,
                            revenue: 0, budget: 0, costPct: 0, posts: 0, uniqueKols: 0, views: 0,
                            attributedRevenue: 0, attributedCostPct: 0
                        }

                        // We accumulate Budget only once per post? No, we are iterating sales.
                        // We need to be careful not to double sum Budget.
                        // Better approach: Accumulate Revenue share to Post objects first?
                        // Or maintain a separate Post Metrics map.
                        // Let's use a PostID -> Metrics map to aggregate first.
                    }
                })
            }
        })

        // Re-think: Is easier to just calculate "Post Metrics" for all filtered posts?
        // Yes.
        const postMetrics = new Map<string, { attributedRev: number }>() // ID -> Rev

        // 1. Calculate Split Credit for ALL sales (global context)
        // Optimization: Only look at sales that *could* be relevant to filtered posts if strictly disjoint? 
        // No, need global context for correct denominator.

        // Broad pass: 
        sales.forEach(sale => { // Must check ALL sales effectively? Or just those in date range?
            // "Attribution Mode" usually implies looking at Sales within the window of the posts.
            // If I filter Post Date = Jan 1..Jan 31. Window = 7 days.
            // I should look at Sales Jan 1 .. Feb 7.
            // Let's just look at Sales in the Filter Date Range for simplicity (Period analysis).
            // OR: Look at all sales potentially covered.
            // Let's stick to Sales in Date Range for now to match Revenue numbers in Period Mode.
            if (sale.date >= filters.dateRange.from && sale.date <= filters.dateRange.to) {
                const saleDate = parseISO(sale.date)
                const candidates = allPostsBySku.get(sale.sku) || []
                const hits = candidates.filter(p => {
                    const diff = differenceInDays(saleDate, parseISO(p.postDate))
                    return diff >= 0 && diff <= filters.attributionWindow
                })

                if (hits.length > 0) {
                    const share = sale.revenue / hits.length
                    hits.forEach(p => {
                        const current = postMetrics.get(p.id) || { attributedRev: 0 }
                        current.attributedRev += share
                        postMetrics.set(p.id, current)
                    })
                }
            }
        })

        // 2. Aggregation for UI
        // Filter posts by UI filters
        const filteredPosts = posts.filter(p =>
            p.postDate >= filters.dateRange.from && p.postDate <= filters.dateRange.to &&
            isSkuSelected(p.sku) && isPicSelected(p.pic) && isChannelSelected(p.channel)
        )

        const skuMap = new Map<string, SkuImpactRow>()
        const timeMap = new Map<string, TimeSeriesPoint>()
        const kolSet = new Set<string>()

        // Trend Aggr: SKU -> { budgets: number[], revenues: number[] }
        const skuTrendMap = new Map<string, { budgets: number[], revenues: number[] }>()

        filteredPosts.forEach(p => {
            const attrRev = postMetrics.get(p.id)?.attributedRev || 0

            // SKU Aggr
            const s = skuMap.get(p.sku) || {
                sku: p.sku, productName: productMap.get(p.sku) || p.sku,
                revenue: 0, budget: 0, costPct: 0, posts: 0, uniqueKols: 0, views: 0,
                attributedRevenue: 0, attributedCostPct: 0,
                costPctTrendSeries: [], costPctTrendLast: null, costPctTrendDeltaPP: null, costPctTrendDirection: "NA"
            }
            s.budget += p.budgetAmount
            s.posts += 1
            s.views += p.viewed
            s.attributedRevenue = (s.attributedRevenue || 0) + attrRev
            skuMap.set(p.sku, s)

            // Trend Aggr
            if (!skuTrendMap.has(p.sku)) {
                skuTrendMap.set(p.sku, {
                    budgets: new Array(bucketLabels.length).fill(0),
                    revenues: new Array(bucketLabels.length).fill(0)
                })
            }
            const trend = skuTrendMap.get(p.sku)!
            const bucketIdx = getBucketIndex(p.postDate, bucketType, bucketLabels)
            if (bucketIdx !== -1) {
                trend.budgets[bucketIdx] += p.budgetAmount
                trend.revenues[bucketIdx] += attrRev
            }

            // Time Aggr
            const t = timeMap.get(p.postDate) || {
                date: p.postDate, revenue: 0, budget: 0, costPct: 0, posts: 0
            }
            t.budget += p.budgetAmount
            t.posts += 1
            t.revenue += attrRev // In attribution mode, show Attributed Rev?
            timeMap.set(p.postDate, t)

            totalBudget += p.budgetAmount
            totalAttributedRev += attrRev
            kolSet.add(p.kolName)
        })

        // Finalize SKU stats (Unique KOLs is hard in one pass, need set)
        // Re-pass for Unique KOLs per SKU?
        const skuKolSets = new Map<string, Set<string>>()
        filteredPosts.forEach(p => {
            if (!skuKolSets.has(p.sku)) skuKolSets.set(p.sku, new Set())
            skuKolSets.get(p.sku)!.add(p.kolName)
        })

        skuMetrics = new Map()
        skuMap.forEach((v, k) => {
            v.uniqueKols = skuKolSets.get(k)?.size || 0
            v.attributedCostPct = v.attributedRevenue && v.attributedRevenue > 0 ? (v.budget / v.attributedRevenue) * 100 : null

            // Finalize Trend
            const trendData = skuTrendMap.get(k)
            if (trendData) {
                const { series, last, delta, direction } = calculateTrend(trendData.budgets, trendData.revenues)
                v.costPctTrendSeries = series
                v.costPctTrendLast = last
                v.costPctTrendDeltaPP = delta
                v.costPctTrendDirection = direction
            }

            skuMetrics.set(k, v)
        })

        timeSeriesMap = timeMap

        kpis = {
            totalRevenue: 0, // In Attrib mode, maybe total Sales in range?
            totalBudget,
            totalCost: totalBudget,
            totalCostPct: totalAttributedRev > 0 ? (totalBudget / totalAttributedRev) * 100 : null,
            totalPosts: filteredPosts.length,
            totalUniqueKols: kolSet.size,
            attributedRevenue: totalAttributedRev,
            attributedCostPct: totalAttributedRev > 0 ? (totalBudget / totalAttributedRev) * 100 : null,
        }

    } else {
        // --- Period Mode (Simple) ---
        // 1. Filter Sales
        const filteredSales = sales.filter(s =>
            s.date >= filters.dateRange.from && s.date <= filters.dateRange.to &&
            isSkuSelected(s.sku)
            // Note: Sales don't have PIC/Channel, so those filters don't apply to "Total Revenue" 
            // BUT usually in Dashboard, if I select PIC="Jane", I expect "Revenue" to show... what?
            // - Revenue of products Jane promoted?
            // - Or just N/A?
            // Standard: "Revenue" is contextual `revenue_sku`.
            // If I filter PIC="Jane", I only see SKUs Jane promoted. 
            // For those SKUs, do I show TOTAL revenue (Period) or just Jane's?
            // Period Mode usually means "Total Market Revenue" vs "Jane's Budget".
            // So we show VALID Sales for the SKUs present in the filtered Posts?
            // Yes, let's filter Sales to only include SKUs that match the Filtered Posts (if PIC/Channel selected).
            // IF only Date/SKU selected, it's direct.
        )

        // 2. Filter Posts
        const filteredPosts = posts.filter(p =>
            p.postDate >= filters.dateRange.from && p.postDate <= filters.dateRange.to &&
            isSkuSelected(p.sku) && isPicSelected(p.pic) && isChannelSelected(p.channel)
        )

        // Active SKUs (union of sales and posts skus? or just selected?)
        // If PIC selected, we only care about SKUs that PIC touched.
        const relevantSkus = new Set<string>()
        if (filters.selectedPics.length > 0 || filters.selectedChannels.length > 0) {
            filteredPosts.forEach(p => relevantSkus.add(p.sku))
        } else {
            // If no narrow filter, show all skus from sales OR posts
            filteredSales.forEach(s => relevantSkus.add(s.sku))
            filteredPosts.forEach(p => relevantSkus.add(p.sku))
        }

        skuMetrics = new Map()
        const skuKolSets = new Map<string, Set<string>>()
        const skuTrendMap = new Map<string, { budgets: number[], revenues: number[] }>()

        // Aggr Posts
        filteredPosts.forEach(p => {
            if (!relevantSkus.has(p.sku)) return
            const s = skuMetrics.get(p.sku) || {
                sku: p.sku, productName: productMap.get(p.sku) || p.sku,
                revenue: 0, budget: 0, costPct: 0, posts: 0, uniqueKols: 0, views: 0,
                costPctTrendSeries: [], costPctTrendLast: null, costPctTrendDeltaPP: null, costPctTrendDirection: "NA"
            }
            s.budget += p.budgetAmount
            s.posts += 1
            s.views += p.viewed
            skuMetrics.set(p.sku, s)

            // Trend Budget
            if (!skuTrendMap.has(p.sku)) {
                skuTrendMap.set(p.sku, {
                    budgets: new Array(bucketLabels.length).fill(0),
                    revenues: new Array(bucketLabels.length).fill(0)
                })
            }
            const trend = skuTrendMap.get(p.sku)!
            const bucketIdx = getBucketIndex(p.postDate, bucketType, bucketLabels)
            if (bucketIdx !== -1) trend.budgets[bucketIdx] += p.budgetAmount

            if (!skuKolSets.has(p.sku)) skuKolSets.set(p.sku, new Set())
            skuKolSets.get(p.sku)!.add(p.kolName)
        })

        // Aggr Sales
        filteredSales.forEach(s => {
            if (!relevantSkus.has(s.sku)) return
            const row = skuMetrics.get(s.sku) || {
                sku: s.sku, productName: productMap.get(s.sku) || s.sku,
                revenue: 0, budget: 0, costPct: 0, posts: 0, uniqueKols: 0, views: 0,
                costPctTrendSeries: [], costPctTrendLast: null, costPctTrendDeltaPP: null, costPctTrendDirection: "NA"
            }
            row.revenue += s.revenue
            skuMetrics.set(s.sku, row)

            // Trend Revenue
            if (!skuTrendMap.has(s.sku)) {
                skuTrendMap.set(s.sku, {
                    budgets: new Array(bucketLabels.length).fill(0),
                    revenues: new Array(bucketLabels.length).fill(0)
                })
            }
            const trend = skuTrendMap.get(s.sku)!
            const bucketIdx = getBucketIndex(s.date, bucketType, bucketLabels)
            if (bucketIdx !== -1) trend.revenues[bucketIdx] += s.revenue
        })

        // Finalize SKU calc
        let totalRevenue = 0
        let totalBudget = 0
        let totalPosts = 0
        const totalUniqueKolsSet = new Set<string>()

        skuMetrics.forEach((v, k) => {
            v.uniqueKols = skuKolSets.get(k)?.size || 0
            v.costPct = v.revenue > 0 ? (v.budget / v.revenue) * 100 : null

            // Finalize Trend
            const trendData = skuTrendMap.get(k)
            if (trendData) {
                const { series, last, delta, direction } = calculateTrend(trendData.budgets, trendData.revenues)
                v.costPctTrendSeries = series
                v.costPctTrendLast = last
                v.costPctTrendDeltaPP = delta
                v.costPctTrendDirection = direction
            }

            totalRevenue += v.revenue
            totalBudget += v.budget
            totalPosts += v.posts
            skuKolSets.get(k)?.forEach(kol => totalUniqueKolsSet.add(kol))
        })

        kpis = {
            totalRevenue,
            totalBudget,
            totalCost: totalBudget, // same as budget
            totalCostPct: totalRevenue > 0 ? (totalBudget / totalRevenue) * 100 : null,
            totalPosts,
            totalUniqueKols: totalUniqueKolsSet.size
        }

        // Time Series (Union of dates)
        timeSeriesMap = new Map()
        // ... (similar aggregation for time series)
        // Simpler: Just walk Sales and Posts again for Time Aggr
        filteredPosts.forEach(p => {
            const t = timeSeriesMap.get(p.postDate) || { date: p.postDate, revenue: 0, budget: 0, costPct: 0, posts: 0 }
            t.budget += p.budgetAmount
            t.posts += 1
            timeSeriesMap.set(p.postDate, t)
        })
        filteredSales.forEach(s => {
            // Only include if SKU is relevant!
            if (relevantSkus.has(s.sku)) {
                const t = timeSeriesMap.get(s.date) || { date: s.date, revenue: 0, budget: 0, costPct: 0, posts: 0 }
                t.revenue += s.revenue
                timeSeriesMap.set(s.date, t)
            }
        })
    }

    // Finalize Time Series Pct
    const timeSeries = Array.from(timeSeriesMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    timeSeries.forEach(t => {
        t.costPct = t.revenue > 0 ? (t.budget / t.revenue) * 100 : null
    })

    const skuTable = Array.from(skuMetrics.values()).sort((a, b) => (b.costPct || 0) - (a.costPct || 0))

    return {
        kpis,
        skuTable,
        timeSeries,
        dataQuality: issues,
        trendBuckets: bucketLabels,
        filterOptions: {
            products: validProducts,
            pics: allPics,
            channels: allChannels
        }
    }
}
