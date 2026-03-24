import { google } from "googleapis"
import { Readable } from "stream"

export const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "13fcUC1dRmeCBEfYaCP_vJW3bkIGWNxqg"

/**
 * Returns a Drive client using OAuth (preferred) or Service Account (fallback).
 * Service Account works for reads but NOT for file creation (no storage quota).
 */
export async function getDriveClient() {
    if (process.env.GOOGLE_REFRESH_TOKEN) {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        )
        oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
        return google.drive({ version: 'v3', auth: oauth2Client })
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error(
            "Missing Google credentials: set GOOGLE_REFRESH_TOKEN (OAuth) or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY (Service Account)"
        )
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
    })

    return google.drive({ version: 'v3', auth })
}

/**
 * Returns a Drive client that uses OAuth — required for file uploads.
 * Service Accounts have no storage quota and cannot create files.
 */
export async function getDriveClientForUpload() {
    if (!process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error(
            "Google Drive upload requires OAuth credentials. " +
            "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in your Vercel environment variables. " +
            "Service Accounts cannot upload files (no storage quota)."
        )
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    )
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
    return google.drive({ version: 'v3', auth: oauth2Client })
}

export function getDriveFolderId() {
    return DRIVE_FOLDER_ID
}

export async function uploadFileToDrive(fileBuffer: Buffer, fileName: string, mimeType: string) {
    const drive = await getDriveClientForUpload()
    const folderId = DRIVE_FOLDER_ID

    console.log("Attempting upload to folder:", folderId)
    console.log("Auth method: OAuth")

    try {
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId],
            },
            media: {
                mimeType,
                body: Readable.from(fileBuffer),
            },
            fields: 'id, webViewLink',
            supportsAllDrives: true,
        })

        const fileId = response.data.id
        if (!fileId) {
            throw new Error("Drive upload returned no file ID")
        }

        await drive.permissions.create({
            fileId,
            supportsAllDrives: true,
            requestBody: { role: "reader", type: "anyone" },
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

export async function searchDriveFiles(query: string) {
    try {
        const drive = await getDriveClient()
        // If we want to restrict search to a specific folder:
        // const folderId = await getDriveFolderId()

        // Construct query: name contains 'query' AND not trashed
        let q = `name contains '${query}' and trashed = false`

        // Optional: restrict to specific folder if folderId is available
        // if (folderId) {
        //    q += ` and '${folderId}' in parents`
        // }

        const res = await drive.files.list({
            q,
            fields: 'files(id, name, webViewLink, mimeType)',
            pageSize: 5
        })

        return res.data.files || []
    } catch (error) {
        console.error("Error searching Drive files:", error)
        return []
    }
}
