"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    // Check if it's an auth error
    const isAuthError = error.message.includes("Invalid Credentials") ||
        error.message.includes("Unauthorized") ||
        error.message.includes("RefreshAccessTokenError")

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
            <h2 className="text-2xl font-bold">Something went wrong!</h2>
            <p className="text-muted-foreground">{error.message}</p>

            {isAuthError ? (
                <div className="flex flex-col gap-2 items-center">
                    <p className="text-red-500 font-medium">Your session has expired or is invalid.</p>
                    <Button onClick={() => signOut({ callbackUrl: "/" })}>
                        Sign Out & Reset
                    </Button>
                </div>
            ) : (
                <Button onClick={() => reset()}>Try again</Button>
            )}
        </div>
    )
}
