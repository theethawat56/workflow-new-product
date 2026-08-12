import { NextResponse } from "next/server"
import { loadJoinedRows } from "@/lib/analytics/data"
import type { Cohort } from "@/lib/analytics/types"

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const { rows } = await loadJoinedRows({
        cohort: (searchParams.get("cohort") as Cohort | "ALL") ?? "ALL",
        channel: searchParams.get("channel") ?? "ALL",
        status: searchParams.get("status") ?? "ALL",
        skuSearch: searchParams.get("sku") ?? undefined,
        dateFrom: searchParams.get("from") ?? undefined,
        dateTo: searchParams.get("to") ?? undefined,
        offset: 0,
        limit: 500_000,
    })

    const headers = [
        "order_date",
        "sku",
        "product_name",
        "cohort",
        "channel_raw",
        "integration_name",
        "status",
        "quantity",
        "line_total",
        "unit_cost",
    ]
    const lines = [
        headers.join(","),
        ...rows.map((r) =>
            [
                r.order_date,
                r.sku,
                `"${r.product_name.replace(/"/g, '""')}"`,
                r.cohort,
                r.channel_raw,
                r.integration_name,
                r.status,
                r.quantity,
                r.line_total,
                r.unit_cost ?? "",
            ].join(","),
        ),
    ]

    return new NextResponse(lines.join("\n"), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="analytics-export.csv"',
        },
    })
}
