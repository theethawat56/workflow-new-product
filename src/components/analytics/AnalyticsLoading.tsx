import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SkeletonBox } from "@/components/layout/PageLoader"

type Variant = "overview" | "table" | "stock" | "data" | "deep-dive"

export function AnalyticsLoading({ variant = "overview" }: { variant?: Variant }) {
    return (
        <div
            className="space-y-6 animate-in fade-in duration-300"
            role="status"
            aria-label="Loading analytics"
        >
            {variant === "overview" && <OverviewSkeleton />}
            {variant === "table" && <TablePageSkeleton />}
            {variant === "stock" && <StockSkeleton />}
            {variant === "data" && <DataSkeleton />}
            {variant === "deep-dive" && <DeepDiveSkeleton />}
            <LoadingSpinner />
        </div>
    )
}

function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading data from Google Sheets…</span>
        </div>
    )
}

function OverviewSkeleton() {
    return (
        <>
            <GuideSkeleton />
            <SkeletonBox className="h-4 w-full max-w-xl" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <KpiCardSkeleton key={i} />
                ))}
            </div>
            <CardSkeleton className="h-28" />
            <div className="grid gap-4 lg:grid-cols-2">
                <ChartCardSkeleton />
                <ChartCardSkeleton />
            </div>
        </>
    )
}

function TablePageSkeleton() {
    return (
        <>
            <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonBox key={i} className="h-9 w-28 rounded-md" />
                ))}
            </div>
            <CardSkeleton className="h-24" />
            <TableCardSkeleton rows={10} cols={9} stickyHeader />
        </>
    )
}

function StockSkeleton() {
    return (
        <>
            <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonBox key={i} className="h-7 w-24 rounded-full" />
                ))}
            </div>
            <TableCardSkeleton rows={12} cols={10} />
        </>
    )
}

function DataSkeleton() {
    return (
        <>
            <CardSkeleton className="h-20" />
            <SkeletonBox className="h-4 w-64" />
            <TableCardSkeleton rows={8} cols={9} />
            <div className="flex justify-center gap-2">
                <SkeletonBox className="h-9 w-24 rounded-md" />
                <SkeletonBox className="h-9 w-24 rounded-md" />
            </div>
        </>
    )
}

function DeepDiveSkeleton() {
    return (
        <>
            <SkeletonBox className="h-4 w-40" />
            <SkeletonBox className="h-4 w-96 max-w-full" />
            <div className="rounded-xl border p-5 space-y-3">
                <SkeletonBox className="h-8 w-2/3 max-w-md" />
                <SkeletonBox className="h-4 w-32" />
                <div className="flex gap-2">
                    <SkeletonBox className="h-6 w-20 rounded-full" />
                    <SkeletonBox className="h-6 w-28 rounded-full" />
                </div>
                <SkeletonBox className="h-10 w-full max-w-lg" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <KpiCardSkeleton key={i} />
                ))}
            </div>
            <ChartCardSkeleton tall />
            <ChartCardSkeleton tall />
            <CardSkeleton className="h-48" />
            <CardSkeleton className="h-36" />
        </>
    )
}

function GuideSkeleton() {
    return (
        <div className="rounded-xl border border-dashed p-4 space-y-3">
            <SkeletonBox className="h-5 w-48" />
            <SkeletonBox className="h-4 w-full max-w-2xl" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonBox key={i} className="h-20 rounded-lg" />
                ))}
            </div>
        </div>
    )
}

function KpiCardSkeleton() {
    return (
        <div className="rounded-xl border bg-card p-4 space-y-2">
            <SkeletonBox className="h-3 w-20" />
            <SkeletonBox className="h-7 w-28" />
            <SkeletonBox className="h-3 w-16" />
        </div>
    )
}

function CardSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("rounded-xl border bg-card p-4", className)}>
            <SkeletonBox className="h-5 w-40 mb-3" />
            <SkeletonBox className="h-full min-h-[60px] w-full" />
        </div>
    )
}

function ChartCardSkeleton({ tall }: { tall?: boolean }) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-4 border-b space-y-2">
                <SkeletonBox className="h-5 w-44" />
                <SkeletonBox className="h-3 w-64" />
            </div>
            <SkeletonBox className={cn("m-4 w-auto", tall ? "h-[300px]" : "h-[240px]")} />
        </div>
    )
}

function TableCardSkeleton({
    rows,
    cols,
    stickyHeader,
}: {
    rows: number
    cols: number
    stickyHeader?: boolean
}) {
    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-4 border-b">
                <SkeletonBox className="h-5 w-48" />
                <SkeletonBox className="h-3 w-72 mt-2" />
            </div>
            <div className="overflow-hidden">
                <div
                    className={cn(
                        "flex gap-4 px-4 py-3 border-b bg-muted/30",
                        stickyHeader && "sticky top-0",
                    )}
                >
                    {Array.from({ length: cols }).map((_, i) => (
                        <SkeletonBox key={i} className="h-4 flex-1 min-w-[48px]" />
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex gap-4 px-4 py-3 border-b last:border-b-0",
                            i % 2 === 1 && "bg-muted/15",
                        )}
                    >
                        {Array.from({ length: cols }).map((_, j) => (
                            <SkeletonBox
                                key={j}
                                className={cn(
                                    "h-4 flex-1 min-w-[40px]",
                                    j === 0 && "max-w-[80px]",
                                )}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}
