import { NextResponse } from "next/server"
import { findAll, createMany } from "@/lib/db/adapter" // We need a delete function, checking if it exists
import { updateProductStatusAction } from "@/app/actions/product"
import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { SHEETS_CONFIG } from "@/lib/db/schema"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { product_id, sku_code } = body

        if (!product_id || !sku_code) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            )
        }

        // 1. Remove from launched_products sheet
        // Since we don't have a deleteOne in adapter exposed nicely for this unique constraint, we might need to implement it or do a manual sheet operation.
        // Let's implement a manual fix using sheets API for now or add deleteOne to adapter if easy.

        // Checking adapter first (I'll assume I need to do raw sheets manipulation for deletion if adapter misses it)
        const sheets = await getSheetsClient()
        const spreadsheetId = await getSpreadsheetId()

        // Find row to delete
        const range = `${SHEETS_CONFIG.launched_products.name}!A:A`
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        })

        const rows = response.data.values || []
        let rowIndex = rows.findIndex((row: string[]) => row[0] === sku_code)

        // Fallback: Search by Product Name if SKU not found
        // Zort SKU (Col A) might differ from Internal SKU, but Name (Col C -> Index 2) should match
        if (rowIndex === -1 && body.product_name) {
            console.log(`Unlaunch: SKU ${sku_code} not found. Trying name search for "${body.product_name}"`)
            rowIndex = rows.findIndex((row: string[]) => row[2] === body.product_name)
        }

        if (rowIndex !== -1) {
            console.log(`Unlaunch: Deleting row ${rowIndex + 1}`)
            // Delete the row
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            deleteDimension: {
                                range: {
                                    sheetId: await getSheetId(sheets, spreadsheetId, SHEETS_CONFIG.launched_products.name),
                                    dimension: "ROWS",
                                    startIndex: rowIndex,
                                    endIndex: rowIndex + 1
                                }
                            }
                        }
                    ]
                }
            })
        } else {
            console.warn(`Unlaunch: Could not find product to delete. SKU: ${sku_code}, Name: ${body.product_name}`)
        }

        // 2. Set Status back to Active
        await updateProductStatusAction(product_id, "Active")

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Unlaunch error:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}

async function getSheetId(sheets: any, spreadsheetId: string, sheetName: string) {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId })
    const sheet = metadata.data.sheets?.find((s: any) => s.properties?.title === sheetName)
    return sheet?.properties?.sheetId
}
