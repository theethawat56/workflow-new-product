import { google } from "googleapis"

export async function getSheetsClient() {
    // If we have a refresh token, use OAuth (User Identity)
    if (process.env.GOOGLE_REFRESH_TOKEN) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        )
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
        return google.sheets({ version: "v4", auth: oauth2Client })
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    return google.sheets({ version: "v4", auth })
}

export async function getSpreadsheetId() {
    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    if (!id) {
        throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined")
    }
    return id
}
