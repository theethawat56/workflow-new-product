import { getReadOnlySheetsClient } from "@/lib/google/sheets-readonly"
import { SHEETS_CONFIG, SheetName } from "@/lib/db/schema"

export class SheetError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SheetError"
    }
}


import { sheetCache } from "./cache"

export async function fetchSheet<T>(sheetName: SheetName, forceRefresh: boolean = false): Promise<T[]> {
    if (!forceRefresh) {
        const cached = sheetCache.get<T>(sheetName)
        if (cached) {
            console.log(`[Cache] Returning cached data for ${sheetName}`)
            return cached
        }
    }

    const config = SHEETS_CONFIG[sheetName]
    if (!config) {
        throw new SheetError(`Configuration not found for sheet: ${sheetName}`)
    }

    const sheets = await getReadOnlySheetsClient()
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    if (!spreadsheetId) {
        throw new SheetError("GOOGLE_SHEETS_SPREADSHEET_ID is not defined")
    }

    try {
        const range = `${config.name}!A:Z`
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        })

        const rows = response.data.values
        if (!rows || rows.length < 1) return [] // Empty sheet

        const headers = rows[0].map((h: string) => h.trim())

        // Header Validation
        const missingHeaders = config.headers.filter(
            (requiredHeader) => !headers.includes(requiredHeader)
        )

        if (missingHeaders.length > 0) {
            throw new SheetError(
                `Missing required headers in ${sheetName}: ${missingHeaders.join(", ")}`
            )
        }

        // Map rows to objects
        const dataRows = rows.slice(1)
        const result = dataRows.map((row) => {
            const obj: any = {}
            config.headers.forEach((headerKey) => {
                const index = headers.indexOf(headerKey)
                if (index !== -1) {
                    obj[headerKey] = row[index]
                }
            })
            return obj as T
        })

        // Store in Cache
        sheetCache.set(sheetName, result)
        console.log(`[Cache] Stored data for ${sheetName}`)

        return result
    } catch (error) {
        if (error instanceof SheetError) throw error
        console.error(`Error fetching sheet ${sheetName}:`, error)
        throw new SheetError(`Failed to fetch data from ${sheetName}`)
    }
}

export async function queryByColumn<T>(
    sheetName: SheetName,
    column: string,
    value: string
): Promise<T[]> {
    const allRows = await fetchSheet<T>(sheetName)
    const lowerValue = value.toLowerCase().trim()

    return allRows.filter((row: any) => {
        const cellValue = row[column]?.toString().toLowerCase().trim()
        return cellValue === lowerValue
    })
}
