import { NextResponse } from 'next/server'
import { fetchSheet } from '@/lib/workspace/data-source'
import { z } from 'zod'

// Validation schemas
const SalesOrderRowSchema = z.object({
  order_date: z.string(),
  status: z.string(),
  sku: z.string(),
  line_total: z.coerce.number(),
})

const DailyResponseSchema = z.object({
  gainers: z.array(z.object({
    sku: z.string(),
    productName: z.string(),
    delta: z.number(),
    currentRevenue: z.number(),
    previousRevenue: z.number(),
  })).max(7),
  losers: z.array(z.object({
    sku: z.string(),
    productName: z.string(),
    delta: z.number(),
    currentRevenue: z.number(),
    previousRevenue: z.number(),
  })).max(7),
})

export type DailyResponse = z.infer<typeof DailyResponseSchema>

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isATBorEUProduct(sku: string): boolean {
  return sku.startsWith('ATB') || sku.startsWith('EU')
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    
    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      )
    }

    const targetDate = parseDate(date)
    if (!targetDate) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    // Calculate previous year date
    const prevYearDate = new Date(targetDate.getFullYear() - 1, targetDate.getMonth(), targetDate.getDate())

    // Fetch sales data
    const rawSalesData = await fetchSheet('sales_orders')
    
    // Parse and filter data
    const salesData = rawSalesData
      .map(row => {
        try {
          return SalesOrderRowSchema.parse(row)
        } catch {
          return null
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .filter(row => row.status === 'Success' && isATBorEUProduct(row.sku))

    // Filter by specific dates
    const currentDayData = salesData.filter(row => {
      const orderDate = parseDate(row.order_date)
      return orderDate && formatDate(orderDate) === formatDate(targetDate)
    })

    const prevYearDayData = salesData.filter(row => {
      const orderDate = parseDate(row.order_date)
      return orderDate && formatDate(orderDate) === formatDate(prevYearDate)
    })

    // Calculate revenue by SKU for both periods
    const currentRevenueBySku = new Map<string, number>()
    const prevRevenueBySku = new Map<string, number>()

    currentDayData.forEach(row => {
      const current = currentRevenueBySku.get(row.sku) || 0
      currentRevenueBySku.set(row.sku, current + row.line_total)
    })

    prevYearDayData.forEach(row => {
      const current = prevRevenueBySku.get(row.sku) || 0
      prevRevenueBySku.set(row.sku, current + row.line_total)
    })

    // Calculate deltas
    const deltas: Array<{
      sku: string
      delta: number
      currentRevenue: number
      previousRevenue: number
    }> = []

    const allSkus = new Set([...currentRevenueBySku.keys(), ...prevRevenueBySku.keys()])
    
    for (const sku of allSkus) {
      const current = currentRevenueBySku.get(sku) || 0
      const previous = prevRevenueBySku.get(sku) || 0
      const delta = current - previous

      if (delta !== 0) { // Only include SKUs with changes
        deltas.push({
          sku,
          delta,
          currentRevenue: current,
          previousRevenue: previous,
        })
      }
    }

    // Sort and get top 7 gainers and losers
    const gainers = deltas
      .filter(item => item.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 7)
      .map(item => ({
        sku: item.sku,
        productName: item.sku, // Will be enriched with actual product names later if needed
        delta: item.delta,
        currentRevenue: item.currentRevenue,
        previousRevenue: item.previousRevenue,
      }))

    const losers = deltas
      .filter(item => item.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 7)
      .map(item => ({
        sku: item.sku,
        productName: item.sku, // Will be enriched with actual product names later if needed
        delta: item.delta,
        currentRevenue: item.currentRevenue,
        previousRevenue: item.previousRevenue,
      }))

    const response: DailyResponse = {
      gainers,
      losers,
    }

    const validatedResponse = DailyResponseSchema.parse(response)
    return NextResponse.json(validatedResponse)

  } catch (error) {
    console.error('Target daily API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch daily target data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}