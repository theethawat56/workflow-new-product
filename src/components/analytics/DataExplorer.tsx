"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import type { JoinedRow } from "@/lib/analytics/types"
import { fmtThb, fmtNum } from "@/lib/analytics/format"
import { SkuLink } from "@/components/analytics/SkuLink"
import { Download } from "lucide-react"

interface DataExplorerProps {
    rows: JoinedRow[]
    total: number
    page: number
    pageSize: number
}

export function DataExplorer({ rows, total, page, pageSize }: DataExplorerProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [exporting, setExporting] = useState(false)

    const cohort = searchParams.get("cohort") ?? "ALL"
    const channel = searchParams.get("channel") ?? "ALL"
    const status = searchParams.get("status") ?? "ALL"
    const sku = searchParams.get("sku") ?? ""
    const dateFrom = searchParams.get("from") ?? ""
    const dateTo = searchParams.get("to") ?? ""

    const setParam = useCallback(
        (key: string, value: string) => {
            const p = new URLSearchParams(searchParams.toString())
            if (value && value !== "ALL") p.set(key, value)
            else p.delete(key)
            p.delete("page")
            router.push(`/analytics/data?${p.toString()}`)
        },
        [router, searchParams],
    )

    async function exportCsv() {
        setExporting(true)
        try {
            const p = new URLSearchParams(searchParams.toString())
            p.set("export", "1")
            p.delete("page")
            const res = await fetch(`/api/analytics/export?${p.toString()}`)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "analytics-export.csv"
            a.click()
            URL.revokeObjectURL(url)
        } finally {
            setExporting(false)
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Filters</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Input
                        placeholder="SKU / name search"
                        className="max-w-[200px]"
                        defaultValue={sku}
                        onBlur={(e) => setParam("sku", e.target.value)}
                    />
                    <Select value={cohort} onValueChange={(v) => setParam("cohort", v)}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Cohort" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All cohorts</SelectItem>
                            <SelectItem value="NEW_2026">NEW_2026</SelectItem>
                            <SelectItem value="NEW_2025">NEW_2025</SelectItem>
                            <SelectItem value="CORE">CORE</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={status} onValueChange={(v) => setParam("status", v)}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All status</SelectItem>
                            <SelectItem value="Success">Success</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Waiting">Waiting</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        className="w-[150px]"
                        defaultValue={dateFrom}
                        onBlur={(e) => setParam("from", e.target.value)}
                    />
                    <Input
                        type="date"
                        className="w-[150px]"
                        defaultValue={dateTo}
                        onBlur={(e) => setParam("to", e.target.value)}
                    />
                    <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </CardContent>
            </Card>

            <p className="text-sm text-muted-foreground">
                Showing {rows.length} of {fmtNum(total)} joined rows (page {page} / {totalPages})
            </p>

            <div className="overflow-x-auto border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Cohort</TableHead>
                            <TableHead>Channel</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Unit cost</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow key={r.row_id}>
                                <TableCell className="text-xs">{r.order_date}</TableCell>
                                <TableCell className="font-mono text-xs">
                                    <SkuLink sku={r.sku} />
                                </TableCell>
                                <TableCell className="max-w-[160px] truncate text-sm">
                                    {r.product_name}
                                </TableCell>
                                <TableCell className="text-xs">{r.cohort}</TableCell>
                                <TableCell className="text-xs max-w-[100px] truncate">
                                    {r.integration_name || r.channel_raw}
                                </TableCell>
                                <TableCell className="text-xs">{r.status}</TableCell>
                                <TableCell className="text-right">{r.quantity}</TableCell>
                                <TableCell className="text-right">{fmtThb(r.line_total)}</TableCell>
                                <TableCell className="text-right">
                                    {r.unit_cost != null ? fmtThb(r.unit_cost) : "—"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex gap-2 justify-center">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => {
                        const p = new URLSearchParams(searchParams.toString())
                        p.set("page", String(page - 1))
                        router.push(`/analytics/data?${p.toString()}`)
                    }}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => {
                        const p = new URLSearchParams(searchParams.toString())
                        p.set("page", String(page + 1))
                        router.push(`/analytics/data?${p.toString()}`)
                    }}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}
