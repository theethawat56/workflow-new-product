"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const links = [
    { href: "/analytics", label: "Overview", exact: true },
    { href: "/analytics/new-overview", label: "Launch Command Center" },
    { href: "/analytics/new-products", label: "New Products" },
    { href: "/analytics/what-if", label: "What-if" },
    { href: "/analytics/stock", label: "Stock / ROP" },
    { href: "/analytics/data", label: "Data Explorer" },
]

export function AnalyticsNav() {
    const pathname = usePathname()
    return (
        <nav className="flex flex-wrap gap-1 border-b pb-3 mb-6">
            {links.map((l) => {
                const active = l.exact
                    ? pathname === l.href
                    : pathname.startsWith(l.href)
                return (
                    <Link
                        key={l.href}
                        href={l.href}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                            active
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                    >
                        {l.label}
                    </Link>
                )
            })}
        </nav>
    )
}
