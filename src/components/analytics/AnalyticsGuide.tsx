import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart3, Database, LineChart, PackageSearch, Warehouse, Sparkles } from "lucide-react"

const SECTIONS = [
    {
        href: "/analytics",
        icon: BarChart3,
        title: "Overview",
        desc: "YTD revenue, new-product share (30–40% target), bridge chart, top gainers/decliners.",
    },
    {
        href: "/analytics/new-overview",
        icon: Sparkles,
        title: "New Product Overview",
        desc: "Overview scoped to New 2026 — revenue, GP trend, contribution, top SKUs. Same layout as Overview.",
    },
    {
        href: "/analytics/new-products",
        icon: LineChart,
        title: "New Products",
        desc: "Cohort table (New 2026 / 2025) with channel-adjusted GM%, velocity vs margin scatter.",
    },
    {
        href: "/analytics/stock",
        icon: Warehouse,
        title: "Stock / ROP",
        desc: "Reorder dashboard — daily velocity, ROP, cover days. Stock from Stock_AT sheet.",
    },
    {
        href: "/analytics/data",
        icon: Database,
        title: "Data Explorer",
        desc: "Paginated joined sales rows. Filter by cohort, channel, date, SKU. Export CSV.",
    },
    {
        href: "/analytics/product/ATB092060",
        icon: PackageSearch,
        title: "Product Deep-Dive",
        desc: "เจาะลึกรายตัว — KPI, trend, channels, stock, verdict & actions. Click any SKU in the app.",
        example: true,
    },
]

export function AnalyticsGuide() {
    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">How this section works</CardTitle>
                <CardDescription>
                    RobotMaker Analytics reads <code>sales_orders</code>,{" "}
                    <code>po_costs</code>, and <code>Stock_AT</code> from Google Sheets.
                    GM% uses Marketplace −32% / Direct −19% (same as Sales dashboard).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {SECTIONS.map(({ href, icon: Icon, title, desc, example }) => (
                        <Link
                            key={href}
                            href={href}
                            className="rounded-lg border p-3 hover:bg-muted/50 transition-colors block"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Icon className="w-4 h-4 text-primary" />
                                <span className="font-medium text-sm">{title}</span>
                                {example && (
                                    <span className="text-[10px] text-muted-foreground">
                                        (example SKU)
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {desc}
                            </p>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
