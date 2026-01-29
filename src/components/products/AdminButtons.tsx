"use client"

import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { EditProductDialog } from "@/components/products/EditProductDialog"

interface AdminButtonsProps {
    productId: string
    isDeleting: boolean
    onDelete: () => void
    product: any
}

export function AdminButtons({ isDeleting, onDelete, product }: AdminButtonsProps) {
    const { data: session } = useSession()

    // Check if user is Admin
    if (session?.user?.role !== "Admin") return null

    return (
        <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete Product"}
            </Button>
            <EditProductDialog product={product} />
        </div>
    )
}
