import Link from "next/link"
import { cn } from "@/lib/utils"

export function SkuLink({
    sku,
    className,
    children,
}: {
    sku: string
    className?: string
    children?: React.ReactNode
}) {
    const href = `/analytics/product/${encodeURIComponent(sku.trim())}`
    return (
        <Link
            href={href}
            className={cn(
                "hover:underline hover:text-primary transition-colors",
                className,
            )}
        >
            {children ?? sku}
        </Link>
    )
}
