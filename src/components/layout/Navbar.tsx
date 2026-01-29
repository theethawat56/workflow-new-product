"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSession, signIn, signOut } from "next-auth/react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Navbar() {
    const { data: session } = useSession()

    return (
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-10">
            {/* Left side: Page Title or Breadcrumb (placeholder for now) */}
            <div className="font-medium text-muted-foreground md:hidden">
                LaunchFlow
            </div>
            <div className="hidden md:block text-sm text-muted-foreground">
                {/* Could add dynamic breadcrumbs here later */}
                Workflow Workspace
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
