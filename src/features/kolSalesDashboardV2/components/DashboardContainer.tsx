"use client"

import { useState, useCallback, useEffect } from "react"
import { DashboardDataV2, DashboardFilters } from "../types"
import { Card } from "@/components/ui/card"
import { Loader2, AlertTriangle } from "lucide-react"
import { FilterBar } from "./FilterBar"
import { KpiCards } from "./KpiCards"
import { SkuImpactTable } from "./SkuImpactTable"
import { Charts } from "./Charts"
import { DataQualityPanel } from "./DataQualityPanel"
import { KolRevenueScatterChart } from "./KolRevenueScatterChart"

export function DashboardContainer() {
    // State
    const [filters, setFilters] = useState<DashboardFilters>({
        dateRange: {
            from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
            to: new Date().toISOString().split('T')[0]
        },
        selectedSkus: [],
        selectedPics: [],
        selectedChannels: [],
        mode: "PERIOD",
        attributionWindow: 1
    })

    const [data, setData] = useState<DashboardDataV2 | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Data Fetching
    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            params.set("from", filters.dateRange.from)
            params.set("to", filters.dateRange.to)
            params.set("mode", filters.mode)
            params.set("window", filters.attributionWindow.toString())
            if (filters.selectedSkus.length) params.set("skus", filters.selectedSkus.join(","))
            if (filters.selectedPics.length) params.set("pics", filters.selectedPics.join(","))
            if (filters.selectedChannels.length) params.set("channels", filters.selectedChannels.join(","))

            const res = await fetch(`/api/kol-sales?${params.toString()}`)
            if (!res.ok) throw new Error("API Failed")

            const json = await res.json()
            setData(json)
        } catch (err) {
            console.error(err)
            setError("Failed to load dashboard")
        } finally {
            setLoading(false)
        }
    }, [filters])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Handlers
    const handleFilterChange = (partial: Partial<DashboardFilters>) => {
        setFilters(prev => ({ ...prev, ...partial }))
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-red-500">
                <AlertTriangle className="h-12 w-12 mb-4" />
                <p className="font-semibold">{error}</p>
                <button onClick={fetchData} className="underline mt-2">Retry</button>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">KOL Sales V2</h1>
                    <p className="text-muted-foreground text-sm">
                        Spending Efficiency & Channel Attribution
                    </p>
                </div>
                {data && data.dataQuality.length > 0 && (
                    <DataQualityPanel issues={data.dataQuality} />
                )}
            </div>

            {/* Filter Bar */}
            <FilterBar
                filters={filters}
                onChange={handleFilterChange}
                options={data?.filterOptions}
                loading={loading}
            />

            {/* Loading State */}
            {loading && !data && (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {/* Main Content */}
            {data && (
                <>
                    <KpiCards kpis={data.kpis} mode={filters.mode} />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Charts data={data.timeSeries} mode={filters.mode} />
                        <KolRevenueScatterChart
                            data={data.skuTable}
                            onSkuClick={(sku) => handleFilterChange({ selectedSkus: [sku] })}
                        />
                    </div>

                    <Card className="p-0 overflow-hidden">
                        <SkuImpactTable
                            rows={data.skuTable}
                            mode={filters.mode}
                            trendBuckets={data.trendBuckets}
                        />
                    </Card>

                    <div className="text-xs text-muted-foreground mt-8 p-4 border rounded-md bg-muted/20">
                        <h4 className="font-semibold mb-2">How to use</h4>
                        <ul className="list-disc pl-4 space-y-1">
                            <li><strong>Period Mode</strong>: Matches Posts and Sales strictly by the selected Date Range. Shows aggregate metrics.</li>
                            <li><strong>Attribution Mode (Split)</strong>: Credits a sale equally to all KOL posts within X days before the sale.</li>
                            <li><strong>Cost %</strong>: (Budget / Revenue) * 100. Lower is better.</li>
                            <li><strong>N/A</strong>: Shown when Revenue is 0 (cannot calculate percentage).</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    )
}
