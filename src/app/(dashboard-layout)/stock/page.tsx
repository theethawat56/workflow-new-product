import { findAll } from "@/lib/db/adapter"
import { StockDashboard } from "@/components/stock/StockDashboard"
import { normalizeStockAtRow } from "@/lib/stock/stock-at-columns"
import { Package2 } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function StockPage() {
    let items: ReturnType<typeof normalizeStockAtRow>[] = []
    let error: string | null = null

    try {
        const raw = await findAll<Record<string, unknown>>("stock_at")
        items = raw
            .map(normalizeStockAtRow)
            .filter((r) => r.SKU || r["Product Name"] || r.STATUS)
    } catch (e: any) {
        error = e.message || "Failed to load stock data"
    }

    return (
        <div className="w-full py-2 space-y-4">
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
