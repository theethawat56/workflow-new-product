"use client"

import { useEffect, useState } from "react"
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
    LineChart,
    ListTodo,
    FileText,
    Disc,
    DollarSign,
    Calculator,
    PanelLeftClose,
    PanelLeft,
} from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import {
    SIDEBAR_CHANGE_EVENT,
    readSidebarOpen,
    writeSidebarOpen,
} from "@/lib/sidebar-state"

interface SidebarProps {
    className?: string
    onItemClick?: () => void
}

export function Sidebar({ className, onItemClick }: SidebarProps) {
    const pathname = usePathname()
    const { data: session } = useSession()
    /** Mobile Sheet drawer — always show full labels; collapse only on desktop rail. */
    const isMobileDrawer = Boolean(onItemClick)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)

    useEffect(() => {
        if (isMobileDrawer) return
        setIsSidebarOpen(readSidebarOpen())
        const onChange = (e: Event) => {
            const detail = (e as CustomEvent<{ open: boolean }>).detail
            if (detail && typeof detail.open === "boolean") {
                setIsSidebarOpen(detail.open)
            } else {
                setIsSidebarOpen(readSidebarOpen())
            }
        }
        window.addEventListener(SIDEBAR_CHANGE_EVENT, onChange)
        return () => window.removeEventListener(SIDEBAR_CHANGE_EVENT, onChange)
    }, [isMobileDrawer])

    const setOpen = (open: boolean) => {
        setIsSidebarOpen(open)
        writeSidebarOpen(open)
    }

    const expanded = isMobileDrawer || isSidebarOpen

    const globalLinks = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/workspace", label: "Workspace", icon: MessageSquare },
        { href: "/dashboard/kol-sales", label: "KOL Attribution", icon: BarChart2, exact: true },
        { href: "/dashboard/target", label: "Target (2026)", icon: Disc },
        { href: "/dashboard/sales", label: "Sales", icon: DollarSign },
        { href: "/dashboard/cohort-growth", label: "Cohort Growth", icon: BarChart },
        { href: "/analytics", label: "RobotMaker Analytics", icon: LineChart },
        { href: "/dashboard/shipping-calculator", label: "Shipping Calculator", icon: Calculator },
        { href: "/dashboard/launch", label: "Launch Control", icon: Rocket },
        { href: "/products/pipeline", label: "New Products", icon: Package },
        { href: "/products/on-sale", label: "Products on Sale", icon: Package },
        { href: "/stock", label: "Stock", icon: Package2 },
        { href: "/about", label: "System Overview", icon: Info },
        { href: "/admin", label: "Admin", icon: Users, requiredRole: "Admin" },
    ]

    const workspaceLinks = [
        { href: "/workspace", label: "Overview", icon: LayoutDashboard },
        { href: "/workspace/products", label: "Products", icon: Package },
        { href: "/workspace/tasks", label: "Tasks", icon: ListTodo },
        { href: "/workspace/assistant", label: "Assistant", icon: MessageSquare },
        { href: "/workspace/files", label: "Files", icon: FileText },
        { href: "/dashboard", label: "Main Dashboard", icon: BarChart },
        { href: "/settings", label: "Settings", icon: Users },
    ]

    const isWorkspaceParams = pathname?.startsWith("/workspace")
    const linksToUse = isWorkspaceParams ? workspaceLinks : globalLinks

    const links = linksToUse.filter((link) => {
        // @ts-ignore
        if (!link.requiredRole) return true
        // @ts-ignore
        return session?.user?.role === link.requiredRole
    })

    const sidebarClass = cn(
        "bg-sidebar border-r border-border min-h-screen hidden md:flex flex-col shrink-0",
        className,
        "transition-all duration-300 ease-in-out overflow-hidden",
        isMobileDrawer ? "w-full !flex" : expanded ? "w-64" : "w-16",
    )

    return (
        <aside className={sidebarClass} data-sidebar-collapsed={!expanded || undefined}>
            <div
                className={cn(
                    "h-16 flex items-center border-b border-border/50 gap-2",
                    expanded ? "px-3 justify-between" : "px-2 justify-center",
                )}
            >
                {expanded && (
                    <span className="text-lg font-medium tracking-tight text-foreground truncate pl-1">
                        LaunchFlow
                    </span>
                )}
                {!isMobileDrawer && (
                    <button
                        type="button"
                        data-testid="sidebar-toggle"
                        onClick={() => setOpen(!isSidebarOpen)}
                        className={cn(
                            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-white shadow-sm",
                            "text-foreground hover:bg-secondary hover:border-primary/40 transition-colors",
                        )}
                        aria-label={isSidebarOpen ? "ยุบเมนู" : "ขยายเมนู"}
                        title={isSidebarOpen ? "ยุบเมนู" : "ขยายเมนู"}
                    >
                        {isSidebarOpen ? (
                            <PanelLeftClose className="h-4 w-4" />
                        ) : (
                            <PanelLeft className="h-4 w-4" />
                        )}
                    </button>
                )}
            </div>

            <div className={cn("flex-1 py-4 space-y-1 overflow-y-auto", expanded ? "px-3" : "px-2")}>
                {links.map((link) => {
                    const Icon = link.icon
                    const isActive =
                        link.href === "/workspace"
                            ? pathname === "/workspace"
                            : pathname.startsWith(link.href)

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={onItemClick}
                            title={!expanded ? link.label : undefined}
                            className={cn(
                                "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                                expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
                                isActive
                                    ? "bg-white shadow-sm text-primary"
                                    : "text-muted-foreground hover:bg-white/50 hover:text-foreground",
                            )}
                        >
                            <Icon
                                className={cn(
                                    "h-4 w-4 shrink-0",
                                    isActive ? "text-primary" : "text-muted-foreground",
                                )}
                            />
                            {expanded && (
                                <>
                                    <span className="truncate">{link.label}</span>
                                    {isActive && (
                                        <div className="ml-auto w-1 h-4 bg-primary rounded-full shrink-0" />
                                    )}
                                </>
                            )}
                        </Link>
                    )
                })}
            </div>

            <div className={cn("border-t border-border/50", expanded ? "p-3" : "p-2")}>
                <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    title={!expanded ? "Sign Out" : undefined}
                    className={cn(
                        "flex w-full items-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
                        expanded ? "gap-3 px-3 py-2.5 text-left" : "justify-center px-2 py-2.5",
                    )}
                >
                    <LogOut className="h-4 w-4 shrink-0" />
                    {expanded && <span className="truncate">Sign Out</span>}
                </button>
            </div>
        </aside>
    )
}
