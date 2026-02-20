import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"

// ── Temporary helper route to generate a Google Drive refresh token ──────────
// After you get your token, delete this file or add it to .gitignore
//
// STEP 1: Visit  http://localhost:3000/api/get-drive-token   to get the auth URL
// STEP 2: Authorize in Google, you'll be redirected back here with a code
// STEP 3: The refresh token is printed on the page — copy it

export const runtime = "nodejs"

const REDIRECT_URI = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/get-drive-token`
    : "http://localhost:3000/api/get-drive-token"

function getOAuthClient() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        REDIRECT_URI
    )
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get("code")
    const error = searchParams.get("error")

    // ── Step 2: Handle callback with code ──────────────────────────────────
    if (code) {
        try {
            const oauth2Client = getOAuthClient()
            const { tokens } = await oauth2Client.getToken(code)

            const refreshToken = tokens.refresh_token

            return new NextResponse(`
<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;max-width:700px">
<h2>✅ Refresh Token Generated!</h2>
<p>Copy this value and add it to your <code>.env.local</code> and Vercel environment:</p>
<pre style="background:#f4f4f4;padding:16px;border-radius:8px;word-break:break-all;font-size:13px">
GOOGLE_REFRESH_TOKEN=${refreshToken}
</pre>
<h3>Next steps:</h3>
<ol>
  <li>Open <code>.env.local</code> and update/add:<br>
    <code>GOOGLE_REFRESH_TOKEN=${refreshToken}</code>
  </li>
  <li>Go to <a href="https://vercel.com" target="_blank">vercel.com</a> → your project → Settings → Environment Variables<br>
    Add or update <code>GOOGLE_REFRESH_TOKEN</code> with the value above</li>
  <li>Redeploy the project</li>
</ol>
<p style="color:red">⚠️ This token is sensitive — do not share it publicly. You can now delete <code>src/app/api/get-drive-token/route.ts</code></p>
</body></html>`, {
                headers: { "Content-Type": "text/html" },
                status: 200,
            })
        } catch (err: any) {
            return new NextResponse(`<h2>❌ Error</h2><pre>${err.message}</pre>`, {
                headers: { "Content-Type": "text/html" },
                status: 500,
            })
        }
    }

    if (error) {
        return new NextResponse(`<h2>❌ Authorization denied</h2><p>${error}</p>`, {
            headers: { "Content-Type": "text/html" },
            status: 400,
        })
    }

    // ── Step 1: Generate the auth URL ──────────────────────────────────────
    const oauth2Client = getOAuthClient()
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/drive.file",
        ],
    })

    return new NextResponse(`
<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;max-width:700px">
<h2>🔑 Get Google Drive Refresh Token</h2>
<p>Click the button below to authorize Google Drive access. You'll be redirected back here with your refresh token.</p>
<p><strong>Redirect URI used:</strong> <code>${REDIRECT_URI}</code></p>
<p>⚠️ Make sure this URI is added to your Google Cloud Console → OAuth Client → Authorized Redirect URIs</p>
<br>
<a href="${authUrl}" style="background:#4285f4;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px">
  Authorize with Google →
</a>
</body></html>`, {
        headers: { "Content-Type": "text/html" },
        status: 200,
    })
}
