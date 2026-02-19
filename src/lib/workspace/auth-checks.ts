import { getReadOnlySheetsClient } from "@/lib/google/sheets-readonly"
import { SHEETS_CONFIG } from "@/lib/db/schema"

export interface UserData {
    email: string
    role: string
    active: boolean
    name?: string
}

export async function findUser(email: string): Promise<UserData | null> {
    if (!email) return null

    const sheets = await getReadOnlySheetsClient()
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

    if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined")
    }

    try {
        console.log(`[AuthChecks] findUser: Searching for ${email} in Sheet ID: ${spreadsheetId.substring(0, 5)}...`)
        const range = `${SHEETS_CONFIG.users.name}!A:Z`
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        })

        const rows = response.data.values
        if (!rows || rows.length < 2) {
            console.log("[AuthChecks] No data found in Users sheet")
            return null
        }

        const headers = rows[0].map((h: string) => h.toLowerCase())
        console.log("[AuthChecks] Found headers:", headers)

        const emailIdx = headers.indexOf('email')
        const roleIdx = headers.indexOf('role')
        const activeIdx = headers.indexOf('active')
        const nameIdx = headers.indexOf('name')

        if (emailIdx === -1 || roleIdx === -1) {
            console.error("[AuthChecks] Missing required columns (email, role) in users sheet")
            return null
        }

        const targetEmail = email.toLowerCase().trim()

        const userRow = rows.slice(1).find((row) => {
            const rowEmail = row[emailIdx]?.toString().toLowerCase().trim()
            return rowEmail === targetEmail
        })

        if (!userRow) {
            console.log(`[AuthChecks] User ${targetEmail} not found in sheet`)
            return null
        }

        console.log(`[AuthChecks] User found:`, userRow)

        const userData = {
            email: userRow[emailIdx],
            role: userRow[roleIdx],
            active: String(userRow[activeIdx]).toUpperCase() === 'TRUE',
            name: nameIdx !== -1 ? userRow[nameIdx] : undefined
        }
        console.log(`[AuthChecks] Parsed UserData:`, userData)
        return userData

    } catch (error) {
        console.error("[AuthChecks] Error finding user:", error)
        return null
    }
}



export function validateAction(userRole: string, actionType: "read" | "write" | "admin"): boolean {
    const role = userRole.toLowerCase()

    if (actionType === "admin") {
        return role === "admin"
    }

    if (actionType === "write") {
        return role === "admin" || role === "editor"
    }

    // Read is allowed for everyone (Viewer, Editor, Admin)
    return true
}
