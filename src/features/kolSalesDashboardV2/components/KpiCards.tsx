import { KpiMetrics, DashboardMode } from "../types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, ShoppingBag, Users, Target } from "lucide-react"

export function KpiCards({ kpis, mode }: { kpis: KpiMetrics, mode: DashboardMode }) {

    const isAttrib = mode === "ATTRIBUTION"
    const revenue = isAttrib ? (kpis.attributedRevenue || 0) : kpis.totalRevenue
    const costPct = isAttrib ? kpis.attributedCostPct : kpis.totalCostPct

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
                title={isAttrib ? "Attributed Revenue" : "Total Revenue"}
                value={`฿${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                icon={<DollarSign className="h-4 w-4 text-green-500" />}
                sub={isAttrib ? "From split credit" : "From sales in range"}
            />

            <MetricCard
                title="KOL Budget"
                value={`฿${kpis.totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                icon={<ShoppingBag className="h-4 w-4 text-blue-500" />}
                sub={`${kpis.totalPosts} posts`}
            />

            <MetricCard
                title="Cost % of Revenue"
                value={(costPct !== null && costPct !== undefined) ? `${costPct.toFixed(1)}%` : "N/A"}
                icon={<Target className="h-4 w-4 text-orange-500" />}
                sub="Target: < 20%" // Hardcoded generic target for visual context
            />

            <MetricCard
                title="Unique KOLs"
                value={kpis.totalUniqueKols.toString()}
                icon={<Users className="h-4 w-4 text-purple-500" />}
            />
        </div>
    )
}

function MetricCard({ title, value, icon, sub }: any) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            </CardContent>
        </Card>
    )
}
