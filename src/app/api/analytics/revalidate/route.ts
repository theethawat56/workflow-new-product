import { NextResponse } from "next/server"
import { revalidateAnalyticsCache } from "@/lib/analytics/data"

export async function POST() {
    try {
        await revalidateAnalyticsCache()
        return NextResponse.json({ ok: true })
    } catch (error) {
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Unknown" },
            { status: 500 },
        )
    }
}
