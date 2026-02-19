"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAuthUrlAction, exchangeCodeAction } from "@/app/actions/google-auth"

function GoogleConnectContent() {
    const searchParams = useSearchParams()
    const code = searchParams.get("code")
    const [refreshToken, setRefreshToken] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleConnect = async () => {
        setLoading(true)
        const url = await getAuthUrlAction()
        window.location.href = url
    }

    useEffect(() => {
        if (code && !refreshToken) {
            const exchange = async () => {
                setLoading(true)
                const res = await exchangeCodeAction(code)
                if (res.success && res.refreshToken) {
                    setRefreshToken(res.refreshToken)
                } else {
                    setError(res.message || "Failed to get token")
                }
                setLoading(false)
            }
            exchange()
        }
    }, [code, refreshToken])

    return (
        <Card className="w-[600px]">
            <CardHeader>
                <CardTitle>Connect Google Account</CardTitle>
                <CardDescription>
                    Authorize the app to access your Google Drive and Sheets as YOU.
                    This solves the "No Storage Quota" error for uploads.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!code && !refreshToken && (
                    <div className="text-center py-6 space-y-6">
                        <div className="text-sm text-left p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                            <p className="font-bold mb-2">⚠️ Important Step First:</p>
                            <p className="mb-2">Ensure this URL is added to <strong>Authorized redirect URIs</strong> in your <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline">Google Cloud Console</a>:</p>
                            <code className="block bg-white p-2 rounded border border-yellow-300 select-all">
                                http://localhost:3000/admin/google
                            </code>
                        </div>
                        <Button onClick={handleConnect} disabled={loading} size="lg">
                            {loading ? "Redirecting..." : "Connect with Google"}
                        </Button>
                    </div>
                )}

                {loading && code && (
                    <div className="text-center py-6">
                        <p className="text-muted-foreground animate-pulse">Exchanging code for tokens...</p>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-100">
                        Error: {error}
                    </div>
                )}

                {refreshToken && (
                    <div className="space-y-4">
                        <div className="p-4 bg-green-50 text-green-700 rounded-md border border-green-100">
                            ✅ <strong>Success!</strong> Copy the Refresh Token below.
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Add this to your <code>.env.local</code> file:</label>
                            <div className="p-4 bg-slate-950 text-slate-50 font-mono text-sm rounded-md break-all relative">
                                GOOGLE_REFRESH_TOKEN="{refreshToken}"
                            </div>
                            <p className="text-xs text-muted-foreground">After saving the file, restart your server.</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default function GoogleConnectPage() {
    return (
        <div className="container mx-auto py-10 flex justify-center">
            <Suspense fallback={<div className="text-center">Loading...</div>}>
                <GoogleConnectContent />
            </Suspense>
        </div>
    )
}
