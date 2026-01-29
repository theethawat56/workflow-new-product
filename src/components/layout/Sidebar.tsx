"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Package,
    Users,
    LogOut
} from "lucide-react"
import { useSession, signOut } from "next-auth/react"

export function Sidebar() {
    const pathname = usePathname()
    const { data: session } = useSession()

    const allLinks = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/products", label: "Products", icon: Package },
        { href: "/admin", label: "Admin", icon: Users, requiredRole: "Admin" },
    ]

    const links = allLinks.filter(link => {
        if (!link.requiredRole) return true
        return session?.user?.role === link.requiredRole
    })

    return (
        <aside className="w-64 bg-sidebar border-r border-border min-h-screen hidden md:flex flex-col">
            <div className="h-16 flex items-center px-6 border-b border-border/50">
                <span className="text-xl font-medium tracking-tight text-foreground">
                    LaunchFlow
                </span>
            </div>

            <div className="flex-1 py-6 px-4 space-y-1">
                {links.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname.startsWith(link.href)

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-white shadow-sm text-primary"
                                    : "text-muted-foreground hover:bg-white/50 hover:text-foreground"
                            )}
                        >
                            <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                            {link.label}
                            {isActive && (
                                <div className="ml-auto w-1 h-4 bg-primary rounded-full" />
                            )}
                        </Link>
                    )
                })}
            </div>

            <div className="p-4 border-t border-border/50">
                <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </button>
            </div>
        </aside>
    )
}
