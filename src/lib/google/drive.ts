import { google } from "googleapis"

export async function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
    })

    return google.drive({ version: "v3", auth })
}

export async function getDriveFolderId() {
    // Optional: if not defined, it might save to root or let user pick.
    // But user requirement says "Optional if using shared drive/folder constraints".
    return process.env.GOOGLE_DRIVE_FOLDER_ID
}
