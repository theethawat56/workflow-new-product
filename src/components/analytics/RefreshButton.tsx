"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export function RefreshButton() {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleRefresh() {
        setLoading(true)
        try {
            await fetch("/api/analytics/revalidate", { method: "POST" })
            router.refresh()
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh data
        </Button>
    )
}
