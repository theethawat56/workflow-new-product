"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSession, signOut } from "next-auth/react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChevronLeft, Menu, PanelLeftClose, PanelLeft } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/Sidebar"
import {
    SIDEBAR_CHANGE_EVENT,
    readSidebarOpen,
    toggleSidebarOpen,
} from "@/lib/sidebar-state"

export function Navbar() {
    const { data: session } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const [isOpen, setIsOpen] = React.useState(false)
    const [sidebarOpen, setSidebarOpen] = React.useState(true)

    React.useEffect(() => {
        setSidebarOpen(readSidebarOpen())
        const onChange = (e: Event) => {
            const detail = (e as CustomEvent<{ open: boolean }>).detail
            if (detail && typeof detail.open === "boolean") setSidebarOpen(detail.open)
            else setSidebarOpen(readSidebarOpen())
        }
        window.addEventListener(SIDEBAR_CHANGE_EVENT, onChange)
        return () => window.removeEventListener(SIDEBAR_CHANGE_EVENT, onChange)
    }, [])

    // Don't show back button on dashboard
    const showBack = pathname !== "/dashboard"

    return (
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
            {/* Left side: Back Button & Title */}
            <div className="flex items-center gap-3">
                {/* Mobile Menu Trigger */}
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-64">
                        <SheetTitle className="hidden">Navigation Menu</SheetTitle>
                        <Sidebar className="w-full h-full border-none flex" onItemClick={() => setIsOpen(false)} />
                    </SheetContent>
                </Sheet>

                {/* Desktop sidebar collapse — always visible next to header title */}
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    data-testid="navbar-sidebar-toggle"
                    className="hidden md:inline-flex h-8 w-8 border-border bg-white shadow-sm"
                    onClick={() => setSidebarOpen(toggleSidebarOpen())}
                    aria-label={sidebarOpen ? "ยุบเมนู" : "ขยายเมนู"}
                    title={sidebarOpen ? "ยุบเมนู Sidebar" : "ขยายเมนู Sidebar"}
                >
                    {sidebarOpen ? (
                        <PanelLeftClose className="h-4 w-4" />
                    ) : (
                        <PanelLeft className="h-4 w-4" />
                    )}
                </Button>

                {showBack && (
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:flex">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
                {showBack && (
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}

                <div className="hidden md:block text-sm text-muted-foreground">
                    Workflow Workspace
                </div>
            </div>

            {/* Right side: Search & Profile */}
            <div className="flex items-center gap-4">
                {session ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-secondary">
                                <Avatar className="h-8 w-8 border border-border">
                                    <AvatarImage src={session.user?.image || ""} alt={session.user?.name || ""} />
                                    <AvatarFallback className="bg-white text-muted-foreground">
                                        {session.user?.name?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-white border-border shadow-[0_4px_12px_rgba(0,0,0,0.05)]" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none text-foreground">{session.user?.name}</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {session.user?.email}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                                Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <Link href="/login">
                        <Button variant="default" className="bg-primary text-primary-foreground hover:opacity-90">Login</Button>
                    </Link>
                )}
            </div>
        </header>
    )
}
