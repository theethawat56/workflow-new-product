"use client"

import * as React from "react"
import { Search, ListTodo, Plus, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LeftRailProps {
    onAction: (action: string) => void
    userRole: string
}

export function LeftRail({ onAction, userRole }: LeftRailProps) {
    const isAdmin = userRole === 'Admin'

    return (
        <div className="w-16 border-r border-border bg-muted/10 flex flex-col items-center py-4 gap-4">
            <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
                onClick={() => onAction("new_chat")}
                title="New Chat"
            >
                <Plus className="h-5 w-5" />
            </Button>

            <div className="w-8 h-px bg-border my-2" />

            <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-foreground"
                onClick={() => onAction("search_sku")}
                title="Search SKU"
            >
                <Search className="h-5 w-5" />
            </Button>

            <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-foreground"
                onClick={() => onAction("my_tasks")}
                title="My Tasks"
            >
                <ListTodo className="h-5 w-5" />
            </Button>

            {isAdmin && (
                <>
                    <div className="w-8 h-px bg-border my-2" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-muted-foreground hover:text-red-600"
                        onClick={() => onAction("admin_tools")}
                        title="Admin Tools"
                    >
                        <Shield className="h-5 w-5" />
                    </Button>
                </>
            )}
        </div>
    )
}
