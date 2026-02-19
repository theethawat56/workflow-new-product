"use client"

import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, LayoutDashboard, Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/Sidebar" // Reusing main sidebar
import { useState } from "react"
import Link from "next/link"

export function WorkspaceHeader() {
    const pathname = usePathname()
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)

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
