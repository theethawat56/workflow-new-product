"use server"

import { google } from "googleapis"

// Initialize OAuth2 Client
const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXTAUTH_URL}/admin/google` // Callback URL
    )
}

export async function getAuthUrlAction() {
    const oauth2Client = getOAuth2Client()

    const scopes = [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets"
    ]

    const url = oauth2Client.generateAuthUrl({
        access_type: "offline", // Essential for getting a refresh token
        scope: scopes,
        prompt: "consent" // Force consent to ensure we get a refresh token
    })

    return url
}

export async function exchangeCodeAction(code: string) {
    try {
        const oauth2Client = getOAuth2Client()
        const { tokens } = await oauth2Client.getToken(code)

        if (!tokens.refresh_token) {
            return { success: false, message: "No refresh token returned. You might have already authorized the app. Try revoking access first or prompt='consent'." }
        }

        return {
            success: true,
            refreshToken: tokens.refresh_token
        }
    } catch (error: any) {
        console.error("Token Exchange Error:", error)
        return { success: false, message: error.message }
    }
}
