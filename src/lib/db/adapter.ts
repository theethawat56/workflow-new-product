import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { SHEETS_CONFIG, SheetName } from "./schema"

export async function findAll<T>(sheetName: SheetName): Promise<T[]> {
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    const range = `${sheetName}!A:Z` // Read all data

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    })

    const rows = response.data.values
    if (!rows || rows.length < 2) return [] // No data or only headers

    const headers = rows[0]
    const dataRows = rows.slice(1)

    return dataRows.map((row) => {
        const obj: any = {}
        headers.forEach((header, index) => {
            obj[header] = row[index]
        })
        return obj as T
    })
}

export async function findOne<T>(sheetName: SheetName, pkField: string, pkValue: string): Promise<T | null> {
    const all = await findAll<any>(sheetName)
    const found = all.find(row => row[pkField] === pkValue)
    return found ? (found as T) : null
}

export async function create<T>(sheetName: SheetName, data: T) {
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    const config = SHEETS_CONFIG[sheetName]

    const row = config.headers.map((header) => (data as any)[header] ?? "")

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            values: [row],
        },
    })
}

export async function createMany<T>(sheetName: SheetName, data: T[]) {
    if (data.length === 0) return

    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    const config = SHEETS_CONFIG[sheetName]

    const rows = data.map(item =>
        config.headers.map((header) => (item as any)[header] ?? "")
    )

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            values: rows,
        },
    })
}

export async function update<T>(
    sheetName: SheetName,
    pkField: string,
    pkValue: string,
    data: Partial<T>
) {
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    const config = SHEETS_CONFIG[sheetName]

    // First find the row index
    const allData = await findAll<any>(sheetName)
    const rowIndex = allData.findIndex((row) => row[pkField] === pkValue)

    if (rowIndex === -1) {
        throw new Error(`Record with ${pkField}=${pkValue} not found in ${sheetName}`)
    }

    // Row number in Sheets is 1-based. Header is 1. Data starts at 2.
    // So if index is 0, it's row 2.
    const sheetRowNumber = rowIndex + 2

    // Construct the update row (merge existing with new)
    const existingRow = allData[rowIndex]
    const updatedRowData = { ...existingRow, ...data }
    const rowValues = config.headers.map((header) => updatedRowData[header] ?? "")

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${sheetRowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            values: [rowValues],
        },
    })
}

export async function deleteRow(
    sheetName: SheetName,
    pkField: string,
    pkValue: string
) {
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    const config = SHEETS_CONFIG[sheetName]

    // Find row index
    const allData = await findAll<any>(sheetName)
    const rowIndex = allData.findIndex((row) => row[pkField] === pkValue)

    if (rowIndex === -1) {
        throw new Error(`Record with ${pkField}=${pkValue} not found in ${sheetName}`)
    }

    // Row number 1-based. Header is 1. Data starts at 2.
    // rowIndex 0 is row 2.
    // sheets API uses 0-based index for deleteDimension.
    // Row 1 is index 0. Row 2 is index 1.
    // So if rowIndex is 0 (first data row), it corresponds to Sheet Row 2, which is Index 1.
    const sheetIndex = rowIndex + 1

    // Get Sheet ID (gid) - assume 0 for first sheet or we need to find it? 
    // Wait, sheetName is the name. We need to find the sheetId (gid) for that name.

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName)

    if (!sheet || typeof sheet.properties?.sheetId !== 'number') {
        throw new Error(`Sheet ${sheetName} not found or invalid`)
    }
    const sheetId = sheet.properties.sheetId

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [
                {
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: "ROWS",
                            startIndex: sheetIndex,
                            endIndex: sheetIndex + 1,
                        },
                    },
                },
            ],
        },
    })
}
