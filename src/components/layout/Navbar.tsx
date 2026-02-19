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
import { ChevronLeft, Menu, LayoutDashboard, Package, Users } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/Sidebar"

export function Navbar() {
    const { data: session } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const [isOpen, setIsOpen] = React.useState(false)

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

                {showBack && (
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:flex">
                        {/* Hidden on mobile to save space? Or keep? User said 'back button implementation' earlier, let's keep it but maybe hide on very small screens if needed. Actually user likes the global back button. Let's keep it visible. */}
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
                {/* Mobile Back Button - Ensure it shows if desired */}
                {showBack && (
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}


                <div className="font-medium text-muted-foreground md:hidden">
                    {/* LaunchFlow - removed as it's in the menu now or duplicates space. Let's keep it minimal */}
                </div>
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
