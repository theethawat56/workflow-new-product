import { NextResponse } from 'next/server'
import { fetchSheet } from '@/lib/workspace/data-source'
import { z } from 'zod'

// Validation schemas
const SalesOrderRowSchema = z.object({
  row_id: z.string(),
  order_id: z.string(), 
  order_date: z.string(),
  success_date: z.string().optional(),
  status: z.string(),
  sku: z.string(),
  product_name: z.string(),
  quantity: z.coerce.number(),
  line_total: z.coerce.number(),
})

type SalesOrderRow = z.infer<typeof SalesOrderRowSchema>

const OverviewResponseSchema = z.object({
  targetProgress: z.object({
    current: z.number(),
    target: z.number(),
    progress: z.number(),
    gap: z.number(),
  }),
  kpis: z.object({
    revenueYoY: z.number(),
    unitsYoY: z.number(),
    aov: z.number(),
    aovYoY: z.number(),
    totalLeak: z.number(),
  }),
  bridge: z.object({
    newGain: z.number(),
    droppedLoss: z.number(),
    carriedUp: z.number(),
    carriedDown: z.number(),
  }),
  windowInfo: z.object({
    windowEnd: z.string(),
    currentYear: z.number(),
    currentWindow: z.object({
      from: z.string(),
      to: z.string(),
    }),
    previousWindow: z.object({
      from: z.string(), 
      to: z.string(),
    }),
  }),
})

export type OverviewResponse = z.infer<typeof OverviewResponseSchema>

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  // Handle various date formats
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isATBorEUProduct(sku: string): boolean {
  return sku.startsWith('ATB') || sku.startsWith('EU')
}

export async function GET() {
  try {
    // Fetch sales orders data
    const rawSalesData = await fetchSheet('sales_orders')
    
    // Parse and validate data
    const salesData: SalesOrderRow[] = []
    const parseErrors: string[] = []
    
    for (const [index, row] of rawSalesData.entries()) {
      try {
        const parsed = SalesOrderRowSchema.parse(row)
        // Apply filters: only Success status and ATB/EU products
        if (parsed.status === 'Success' && isATBorEUProduct(parsed.sku)) {
          salesData.push(parsed)
        }
      } catch (error) {
        parseErrors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`)
      }
    }

    if (parseErrors.length > 0) {
      console.warn(`Data parsing warnings:`, parseErrors.slice(0, 5))
    }

    // Calculate time windows (YTD apples-to-apples)
    const validDates = salesData
      .map(row => parseDate(row.order_date))
      .filter((date): date is Date => date !== null)
    
    if (validDates.length === 0) {
      throw new Error('No valid order dates found in sales data')
    }

    const windowEnd = new Date(Math.max(...validDates.map(d => d.getTime())))
    const currentYear = windowEnd.getFullYear()
    
    const currentWindowStart = new Date(currentYear, 0, 1) // Jan 1 current year
    const previousWindowStart = new Date(currentYear - 1, 0, 1) // Jan 1 previous year
    const previousWindowEnd = new Date(windowEnd.getFullYear() - 1, windowEnd.getMonth(), windowEnd.getDate())

    const windowInfo = {
      windowEnd: formatDate(windowEnd),
      currentYear,
      currentWindow: {
        from: formatDate(currentWindowStart),
        to: formatDate(windowEnd),
      },
      previousWindow: {
        from: formatDate(previousWindowStart),
        to: formatDate(previousWindowEnd),
      },
    }

    // Filter data by time windows
    const currentData = salesData.filter(row => {
      const orderDate = parseDate(row.order_date)
      return orderDate && orderDate >= currentWindowStart && orderDate <= windowEnd
    })

    const previousData = salesData.filter(row => {
      const orderDate = parseDate(row.order_date)
      return orderDate && orderDate >= previousWindowStart && orderDate <= previousWindowEnd
    })

    // Calculate revenue and units
    const revCur = currentData.reduce((sum, row) => sum + row.line_total, 0)
    const revPrev = previousData.reduce((sum, row) => sum + row.line_total, 0)
    const target = revPrev * 1.20

    const unitsCur = currentData.reduce((sum, row) => sum + row.quantity, 0)
    const unitsPrev = previousData.reduce((sum, row) => sum + row.quantity, 0)

    // Calculate unique orders for AOV
    const uniqueOrdersCur = new Set(currentData.map(row => row.order_id)).size
    const uniqueOrdersPrev = new Set(previousData.map(row => row.order_id)).size

    const aovCur = uniqueOrdersCur > 0 ? revCur / uniqueOrdersCur : 0
    const aovPrev = uniqueOrdersPrev > 0 ? revPrev / uniqueOrdersPrev : 0

    // Calculate YoY changes
    const revenueYoY = revPrev > 0 ? (revCur / revPrev) - 1 : 0
    const unitsYoY = unitsPrev > 0 ? (unitsCur / unitsPrev) - 1 : 0
    const aovYoY = aovPrev > 0 ? (aovCur / aovPrev) - 1 : 0

    // Calculate bridge analysis
    const currentSkuRevenue = new Map<string, number>()
    const previousSkuRevenue = new Map<string, number>()

    // Group revenue by SKU
    currentData.forEach(row => {
      const current = currentSkuRevenue.get(row.sku) || 0
      currentSkuRevenue.set(row.sku, current + row.line_total)
    })

    previousData.forEach(row => {
      const current = previousSkuRevenue.get(row.sku) || 0
      previousSkuRevenue.set(row.sku, current + row.line_total)
    })

    // Calculate bridge components
    const allSkus = new Set([...currentSkuRevenue.keys(), ...previousSkuRevenue.keys()])
    
    let newGain = 0       // SKUs in current but not in previous
    let droppedLoss = 0   // SKUs in previous but not in current
    let carriedUp = 0     // Positive changes in existing SKUs
    let carriedDown = 0   // Negative changes in existing SKUs

    for (const sku of allSkus) {
      const curRev = currentSkuRevenue.get(sku) || 0
      const prevRev = previousSkuRevenue.get(sku) || 0

      if (curRev > 0 && prevRev === 0) {
        // New SKU
        newGain += curRev
      } else if (curRev === 0 && prevRev > 0) {
        // Dropped SKU
        droppedLoss -= prevRev
      } else if (curRev > 0 && prevRev > 0) {
        // Existing SKU
        const delta = curRev - prevRev
        if (delta > 0) {
          carriedUp += delta
        } else if (delta < 0) {
          carriedDown += delta
        }
      }
    }

    // Total leak is the sum of negative components
    const totalLeak = Math.abs(droppedLoss) + Math.abs(carriedDown)

    // Prepare response
    const response: OverviewResponse = {
      targetProgress: {
        current: revCur,
        target,
        progress: target > 0 ? revCur / target : 0,
        gap: Math.max(0, target - revCur),
      },
      kpis: {
        revenueYoY,
        unitsYoY,
        aov: aovCur,
        aovYoY,
        totalLeak,
      },
      bridge: {
        newGain,
        droppedLoss,
        carriedUp,
        carriedDown,
      },
      windowInfo,
    }

    // Validate response
    const validatedResponse = OverviewResponseSchema.parse(response)

    return NextResponse.json(validatedResponse)

  } catch (error) {
    console.error('Target overview API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch target overview data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}