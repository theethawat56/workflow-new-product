/**
 * Sync Dataslot KOL_POST_SUBMISSION → Google Sheet `KOL` tab.
 *
 * - GET / POST: triggers sync. Authentication:
 *     • CRON_SECRET in `Authorization: Bearer <secret>` (Vercel Cron), OR
 *     • logged-in dashboard user (NextAuth session).
 *
 * Scheduled daily via vercel.json (after Zortout syncs).
 * Incremental: appends only posts whose taskNumber is not already in the sheet.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { syncKolToSheet } from "@/lib/dataslot/kol-sync"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function isAuthorized(request: Request): Promise<boolean> {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const header = request.headers.get("authorization") || ""
        if (header === `Bearer ${cronSecret}`) return true
    }
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.email) return true
    } catch {
        /* fall through */
    }
    return false
}

async function runSync(request: Request) {
    if (!(await isAuthorized(request))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startedAt = Date.now()

    try {
        const result = await syncKolToSheet()

        // Bust analytics caches that read the KOL tab.
        try {
            const { revalidateTag } = await import("next/cache")
            revalidateTag("analytics-data", "default")
            revalidateTag("launch-command-center", "default")
        } catch {
            /* revalidate only works in Next runtime */
        }

        return NextResponse.json({
            ...result,
            startedAt: new Date(startedAt).toISOString(),
        })
    } catch (err) {
        return NextResponse.json(
            {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
                elapsedMs: Date.now() - startedAt,
            },
            { status: 500 },
        )
    }
}

export async function GET(request: Request) {
    return runSync(request)
}

export async function POST(request: Request) {
    return runSync(request)
}
