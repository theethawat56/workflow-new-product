"use client"

import { Button } from "@/components/ui/button"
import { initializeDatabaseAction } from "@/app/actions/admin"
import { useState } from "react"

export function DatabaseManagementSection() {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")

    const handleInit = async () => {
        setLoading(true)
        const res = await initializeDatabaseAction()
        setMessage(res.message)
        setLoading(false)
    }

    return (
        <div className="p-4 border rounded shadow">
            <h2 className="text-xl mb-2">Database Management</h2>
            <p className="mb-4 text-gray-600">
                Initialize the database structure in Google Sheets. This is safe to run multiple times (it verifies headers).
            </p>
            <Button onClick={handleInit} disabled={loading}>
                {loading ? "Initializing..." : "Initialize Database"}
            </Button>
            {message && <p className="mt-4 font-mono">{message}</p>}
        </div>
    )
}
