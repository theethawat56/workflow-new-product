"use client"

import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Menu, PanelLeft, PanelLeftClose } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/Sidebar"
import { useEffect, useState } from "react"
import Link from "next/link"
import {
    SIDEBAR_CHANGE_EVENT,
    readSidebarOpen,
    toggleSidebarOpen,
} from "@/lib/sidebar-state"

export function WorkspaceHeader() {
    const pathname = usePathname()
    const [isOpen, setIsOpen] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)

    useEffect(() => {
        setSidebarOpen(readSidebarOpen())
        const onChange = (e: Event) => {
            const detail = (e as CustomEvent<{ open: boolean }>).detail
            if (detail && typeof detail.open === "boolean") setSidebarOpen(detail.open)
            else setSidebarOpen(readSidebarOpen())
        }
        window.addEventListener(SIDEBAR_CHANGE_EVENT, onChange)
        return () => window.removeEventListener(SIDEBAR_CHANGE_EVENT, onChange)
    }, [])

    // Determine title based on path
    const getTitle = () => {
        if (pathname?.includes("/products")) return "Products"
        if (pathname?.includes("/tasks")) return "Tasks"
        if (pathname?.includes("/assistant")) return "Assistant"
        if (pathname?.includes("/files")) return "Files"
        return "Workspace Overview"
    }

    return (
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm px-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
                {/* Mobile Menu */}
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

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    data-testid="workspace-sidebar-toggle"
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

                {/* Explicit Back to Dashboard Button */}
                <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground hidden md:flex">
                        <LayoutDashboard className="h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </Link>

                <div className="h-6 w-px bg-border mx-2 hidden md:block" />

                <h1 className="text-lg font-semibold tracking-tight ml-2 md:ml-0">
                    {getTitle()}
                </h1>
            </div>

            <div className="flex items-center gap-2">
                {/* Mobile Back Icon */}
                <Link href="/dashboard">
                    <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground">
                        <LayoutDashboard className="h-5 w-5" />
                    </Button>
                </Link>
            </div>
        </header>
    )
}
