import { AnalyticsNav } from "@/components/analytics/AnalyticsNav"
import { RefreshButton } from "@/components/analytics/RefreshButton"

export default function AnalyticsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="w-full">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-1">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        RobotMaker Analytics
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        New-product contribution & stock-out risk · ATB / EU families
                    </p>
                </div>
                <RefreshButton />
            </div>
            <AnalyticsNav />
            {children}
        </div>
    )
}
