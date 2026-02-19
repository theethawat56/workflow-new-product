"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { updateProductStatusAction } from "@/app/actions/product"
import { Loader2 } from "lucide-react"

interface ProductStatusEditorProps {
    productId: string
    currentStatus: string
}

export function ProductStatusEditor({ productId, currentStatus }: ProductStatusEditorProps) {
    const [status, setStatus] = useState(currentStatus)
    const [isLoading, setIsLoading] = useState(false)

    const handleStatusChange = async (newStatus: string) => {
        setIsLoading(true)
        try {
            const result = await updateProductStatusAction(productId, newStatus)
            if (result.success) {
                setStatus(newStatus)
                // toast.success(`Status updated to ${newStatus}`)
            } else {
                alert("Failed to update status")
            }
        } catch (error) {
            alert("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    // Determine badge variant based on status
    const getVariant = (s: string) => {
        switch (s) {
            case "Active": return "default"
            case "Launched": return "success" // Assuming success variant exists or default
            case "Draft": return "secondary"
            case "Existing": return "outline"
            default: return "secondary"
        }
    }

    return (
        <Select value={status} onValueChange={handleStatusChange} disabled={isLoading}>
            <SelectTrigger className="w-[140px] h-8">
                <div className="flex items-center gap-2">
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span className={isLoading ? "opacity-50" : ""}>{status}</span>
                </div>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Launched">Launched</SelectItem>
                <SelectItem value="Existing">Existing</SelectItem>
                <SelectItem value="Hold">Hold</SelectItem>
            </SelectContent>
        </Select>
    )
}
