"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Package,
    Package2,
    Users,
    LogOut,
    Rocket,
    Info,
    MessageSquare,
    BarChart,
    BarChart2,
    ListTodo,
    FileText,
    Disc,
    DollarSign
} from "lucide-react"
import { useSession, signOut } from "next-auth/react"

interface SidebarProps {
    className?: string
    onItemClick?: () => void
}

export function Sidebar({ className, onItemClick }: SidebarProps) {
    const pathname = usePathname()
    const { data: session } = useSession()

    // Original Global Links
    const globalLinks = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/workspace", label: "Workspace", icon: MessageSquare },
        { href: "/dashboard/kol-sales", label: "KOL Attribution", icon: BarChart2, exact: true },
        { href: "/dashboard/target", label: "Target (2026)", icon: Disc },
        { href: "/dashboard/sales", label: "Sales", icon: DollarSign },
        { href: "/dashboard/launch", label: "Launch Control", icon: Rocket },
        { href: "/products/pipeline", label: "New Products", icon: Package },
        { href: "/products/on-sale", label: "Products on Sale", icon: Package },
        { href: "/stock", label: "Stock", icon: Package2 },
        { href: "/about", label: "System Overview", icon: Info },
        { href: "/admin", label: "Admin", icon: Users, requiredRole: "Admin" },
    ]

    // Workspace Specific Links
    const workspaceLinks = [
        { href: "/workspace", label: "Overview", icon: LayoutDashboard },
        { href: "/workspace/products", label: "Products", icon: Package },
        { href: "/workspace/tasks", label: "Tasks", icon: ListTodo },
        { href: "/workspace/assistant", label: "Assistant", icon: MessageSquare },
        { href: "/workspace/files", label: "Files", icon: FileText },
        { href: "/dashboard", label: "Main Dashboard", icon: BarChart }, // Back to main
        { href: "/settings", label: "Settings", icon: Users },
    ]

    const isWorkspaceParams = pathname?.startsWith("/workspace")
    const linksToUse = isWorkspaceParams ? workspaceLinks : globalLinks

    const links = linksToUse.filter(link => {
        // @ts-ignore
        if (!link.requiredRole) return true
        // @ts-ignore
        return session?.user?.role === link.requiredRole
    })

    // Use passed className or default
    const sidebarClass = cn("bg-sidebar border-r border-border min-h-screen hidden md:flex flex-col", className)

    return (
        <aside className={sidebarClass}>
            <div className="h-16 flex items-center px-6 border-b border-border/50">
                <span className="text-xl font-medium tracking-tight text-foreground">
                    LaunchFlow
                </span>
            </div>

            <div className="flex-1 py-6 px-4 space-y-1">
                {links.map((link) => {
                    const Icon = link.icon
                    // Active logic: In workspace, strict match for overview, else prefix.
                    // In global, similar logic.
                    const isActive = link.href === "/workspace"
                        ? pathname === "/workspace"
                        : pathname.startsWith(link.href)

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={onItemClick}
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
