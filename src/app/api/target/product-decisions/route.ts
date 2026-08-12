import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchSheet } from '@/lib/workspace/data-source'
import { buildSkuProductNameMap, resolveProductName } from '@/lib/target/product-names'
import { ensureSheetWithHeaders } from '@/lib/sales/order-sheet-writer'
import { getSheetsClient, getSpreadsheetId } from '@/lib/google/sheets'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// Validation schemas
const ProductDecisionSheetRowSchema = z.object({
  sku: z.string(),
  status: z.enum(['pending', 'keep', 'cut', 'watch', 'restock']),
  note: z.string().optional().default(''),
  decided_at: z.string().optional().default(''),
  updated_by: z.string().optional().default(''),
  updated_at: z.string().optional().default(''),
})

const ProductDecisionRowSchema = ProductDecisionSheetRowSchema.extend({
  productName: z.string(),
})

const ProductDecisionUpdateSchema = z.object({
  sku: z.string().min(1),
  status: z.enum(['pending', 'keep', 'cut', 'watch', 'restock']),
  note: z.string().optional().default(''),
})

const ProductDecisionsResponseSchema = z.array(ProductDecisionRowSchema)

type ProductDecisionRow = z.infer<typeof ProductDecisionRowSchema>
// type ProductDecisionUpdate = z.infer<typeof ProductDecisionUpdateSchema>

const PRODUCT_DECISIONS_CONFIG = {
  name: 'product_decisions',
  headers: ['sku', 'status', 'note', 'decided_at', 'updated_by', 'updated_at'] as const,
}

async function ensureProductDecisionsSheet() {
  await ensureSheetWithHeaders(PRODUCT_DECISIONS_CONFIG.name, PRODUCT_DECISIONS_CONFIG.headers)
}

function rowToValues(row: ProductDecisionRow): unknown[] {
  return PRODUCT_DECISIONS_CONFIG.headers.map(header => row[header] ?? '')
}

export async function GET() {
  try {
    await ensureProductDecisionsSheet()
    
    const rawData = await fetchSheet('product_decisions' as any) // Type assertion for new sheet
    const nameMap = await buildSkuProductNameMap()
    
    const decisions: ProductDecisionRow[] = []
    
    for (const row of rawData) {
      try {
        const sheetRow = ProductDecisionSheetRowSchema.parse(row)
        decisions.push({
          ...sheetRow,
          productName: resolveProductName(sheetRow.sku, nameMap),
        })
      } catch (error) {
        // Skip invalid rows
        console.warn('Invalid product decision row:', error)
      }
    }

    const validatedResponse = ProductDecisionsResponseSchema.parse(decisions)
    return NextResponse.json(validatedResponse)

  } catch (error) {
    console.error('Product decisions GET error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch product decisions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Get user session
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const update = ProductDecisionUpdateSchema.parse(body)

    await ensureProductDecisionsSheet()

    // Read existing data to check for updates
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${PRODUCT_DECISIONS_CONFIG.name}!A2:F`,
    })

    const existingRows = (existingRes.data.values as string[][]) ?? []
    const existingIndex = existingRows.findIndex(row => row[0] === update.sku)

    const now = new Date().toISOString()
    const decidedAt = update.status !== 'pending' ? now : ''

    const newRow: ProductDecisionRow = {
      sku: update.sku,
      productName: resolveProductName(update.sku, await buildSkuProductNameMap()),
      status: update.status,
      note: update.note || '',
      decided_at: decidedAt,
      updated_by: session.user.email,
      updated_at: now,
    }

    if (existingIndex >= 0) {
      // Update existing row
      const sheetRowNumber = existingIndex + 2 // +2 because sheet starts from row 1 and data from row 2
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${PRODUCT_DECISIONS_CONFIG.name}!A${sheetRowNumber}:F${sheetRowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowToValues(newRow)],
        },
      })
    } else {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${PRODUCT_DECISIONS_CONFIG.name}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowToValues(newRow)],
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: newRow,
    })

  } catch (error) {
    console.error('Product decisions POST error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to update product decision',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}