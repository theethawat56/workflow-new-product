"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Generic skeleton placeholder box */
export function SkeletonBox({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "rounded-lg bg-muted animate-pulse",
                className
            )}
        />
    )
}

/** Full-page skeleton that matches the dashboard content area */
export function PageLoader() {
    return (
        <div className="space-y-6 p-2 animate-in fade-in duration-300">
            {/* Page title */}
            <div className="space-y-2">
                <SkeletonBox className="h-8 w-56" />
                <SkeletonBox className="h-4 w-80" />
            </div>

            {/* KPI cards row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <SkeletonBox className="h-4 w-24" />
                            <SkeletonBox className="h-4 w-4 rounded-full" />
                        </div>
                        <SkeletonBox className="h-8 w-32" />
                        <SkeletonBox className="h-2 w-full rounded-full" />
                    </div>
                ))}
            </div>

            {/* Table / content block */}
            <div className="rounded-xl border bg-card overflow-hidden">
                {/* Table header */}
                <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/40">
                    {[40, 24, 32, 20, 16].map((w, i) => (
                        <SkeletonBox key={i} className={`h-4 w-${w}`} />
                    ))}
                </div>
                {/* Table rows */}
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex items-center gap-4 px-4 py-4 border-b last:border-b-0",
                            i % 2 === 1 && "bg-muted/20"
                        )}
                    >
                        <SkeletonBox className="h-8 w-8 rounded-full shrink-0" />
                        <SkeletonBox className="h-4 flex-1 max-w-[200px]" />
                        <SkeletonBox className="h-4 w-16" />
                        <SkeletonBox className="h-4 w-20" />
                        <SkeletonBox className="h-4 w-12 ml-auto" />
                        <SkeletonBox className="h-6 w-16 rounded-full" />
                    </div>
                ))}
            </div>

            {/* Spinner at the bottom */}
            <div className="flex justify-center pt-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        </div>
    )
}
