import { google } from "googleapis"
import { Readable } from "stream"

export async function getDriveClient() {
    // If we have a refresh token, use OAuth (User Identity) - Solves quota issues
    if (process.env.GOOGLE_REFRESH_TOKEN) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        )
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
        return google.drive({ version: 'v3', auth: oauth2Client })
    }

    // Fallback to Service Account
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
    })

    return google.drive({ version: 'v3', auth })
}

export async function getDriveFolderId() {
    return process.env.GOOGLE_DRIVE_FOLDER_ID
}

export async function uploadFileToDrive(fileBuffer: Buffer, fileName: string, mimeType: string) {
    const drive = await getDriveClient()

    // Explicit folder ID from requirements
    const folderId = "13fcUC1dRmeCBEfYaCP_vJW3bkIGWNxqg"

    console.log("Attempting upload to folder:", folderId)
    console.log("Using Service Account:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)

    try {
        const fileMetadata = {
            name: fileName,
            parents: [folderId]
        }

        const media = {
            mimeType: mimeType,
            body: Readable.from(fileBuffer)
        }

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
            supportsAllDrives: true
        })

        return response.data
    } catch (error: any) {
        console.error("Drive Upload Error:", error)
        if (error.response) {
            console.error("Error Response Data:", JSON.stringify(error.response.data, null, 2))
        }
        throw error
    }
}
