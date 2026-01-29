"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function Navbar() {
    const { data: session } = useSession()
    const router = useRouter()
    const pathname = usePathname()

    // Don't show back button on dashboard
    const showBack = pathname !== "/dashboard"

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
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
            {/* Left side: Back Button & Title */}
            <div className="flex items-center gap-3">
                {/* Mobile Menu Trigger */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[80%] sm:w-[300px] p-0">
                        <div className="h-16 flex items-center px-6 border-b border-border/50">
                            <span className="text-xl font-medium tracking-tight text-foreground">
                                LaunchFlow
                            </span>
                        </div>
                        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
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
                                                ? "bg-muted shadow-sm text-primary"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        )}
                                    >
                                        <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                                        {link.label}
                                    </Link>
                                )
                            })}
                        </div>
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
