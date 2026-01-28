import { google } from "googleapis"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"

export async function getSheetsClient() {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
        throw new Error("Unauthorized: No session or access token found")
    }

    if (session.error === "RefreshAccessTokenError") {
        throw new Error("Authentication Refresh Failed: Please sign out and sign in again.")
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: session.accessToken })

    return google.sheets({ version: "v4", auth })
}

export async function getSpreadsheetId() {
    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    if (!id) {
        throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined")
    }
    return id
}
