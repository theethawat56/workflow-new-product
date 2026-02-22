import { findAll } from "@/lib/db/adapter"
import { StockDashboard } from "@/components/stock/StockDashboard"
import { Package2 } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function StockPage() {
    let items: any[] = []
    let error: string | null = null

    try {
        items = await findAll<any>("stock_at")
    } catch (e: any) {
        error = e.message || "Failed to load stock data"
    }

    return (
        <div className="container mx-auto py-10 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-100">
                    <Package2 className="h-6 w-6 text-sky-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Stock Overview</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Real-time inventory levels from AT warehouse · {items.length} SKUs tracked
                    </p>
                </div>
            </div>

            {error ? (
                <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm">
                    ⚠️ Could not load stock data: {error}
                </div>
            ) : (
                <StockDashboard items={items} />
            )}
        </div>
    )
}
