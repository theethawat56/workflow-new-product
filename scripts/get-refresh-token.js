/**
 * Run this script locally to generate a fresh Google OAuth refresh token
 * for Google Drive access.
 *
 * Usage:
 *   node scripts/get-refresh-token.js
 *
 * Then copy the printed refresh token into:
 *  1. .env.local  → GOOGLE_REFRESH_TOKEN=<value>
 *  2. Vercel env  → npx vercel env add GOOGLE_REFRESH_TOKEN production
 */

const { google } = require("googleapis")
const http = require("http")
const url = require("url")
const open = require("open").default || require("open")

// ─── Read credentials from env (same ones used by the app) ──────────────────
require("dotenv").config({ path: ".env.local" })

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local")
    process.exit(1)
}

// NOTE: This redirect URI MUST be added to your Google Cloud Console:
// APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs
// Add: http://localhost:3001/oauth/callback
const REDIRECT_URI = "http://localhost:3001/oauth/callback"

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

// Request Drive scope so we can upload files
const SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
]

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",   // Force consent screen so we always get a refresh token
    scope: SCOPES,
})

console.log("\n🔑  Opening browser for Google authorization...\n")
console.log("If the browser does not open, visit this URL manually:\n")
console.log(authUrl)
console.log()

// ─── Start a tiny local server to catch the OAuth callback ──────────────────
const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true)
    if (!parsed.pathname.startsWith("/oauth/callback")) return

    const code = parsed.query.code
    if (!code) {
        res.end("No code found in callback.")
        return
    }

    try {
        const { tokens } = await oauth2Client.getToken(code)

        res.end(`
            <h2>✅ Success! Refresh token generated.</h2>
            <p>Copy the token below into your <code>.env.local</code> and Vercel environment.</p>
            <pre style="background:#f4f4f4;padding:12px;border-radius:6px;word-break:break-all">
GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}
            </pre>
            <p>You can close this tab now.</p>
        `)

        console.log("\n✅  SUCCESS! Here is your new refresh token:\n")
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
        console.log("\nNext steps:")
        console.log("1. Add to .env.local: GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token)
        console.log("2. Add to Vercel:     npx vercel env add GOOGLE_REFRESH_TOKEN production")
        console.log()

    } catch (err) {
        console.error("❌  Error exchanging code for tokens:", err.message)
        res.end("Error: " + err.message)
    } finally {
        server.close()
    }
})

server.listen(3001, () => {
    // Try to open the browser automatically
    try { open(authUrl).catch(() => { }) } catch (_) { }
})
