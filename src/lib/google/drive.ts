import { google } from "googleapis"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"

export async function getDriveClient() {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
        throw new Error("Unauthorized: No session or access token found")
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: session.accessToken })

    return google.drive({ version: "v3", auth })
}

export async function getDriveFolderId() {
    // Optional: if not defined, it might save to root or let user pick.
    // But user requirement says "Optional if using shared drive/folder constraints".
    return process.env.GOOGLE_DRIVE_FOLDER_ID
}
