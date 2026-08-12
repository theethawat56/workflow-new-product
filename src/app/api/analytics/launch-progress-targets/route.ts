import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import {
    deleteProgressGoalOverride,
    upsertProgressGoalOverride,
} from "@/lib/analytics/launch-progress-targets"

const UpdateSchema = z.object({
    groupId: z.string().min(1),
    label: z.string().optional(),
    progressGoal: z.number().positive().nullable(),
})

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 })
        }

        const body = UpdateSchema.parse(await request.json())
        const groupId = body.groupId.trim().toUpperCase()

        if (body.progressGoal == null) {
            await deleteProgressGoalOverride(groupId)
            return NextResponse.json({ success: true, reset: true, groupId })
        }

        const row = await upsertProgressGoalOverride({
            groupId,
            label: body.label,
            progressGoal: body.progressGoal,
            updatedBy: session.user.email,
        })

        try {
            const { revalidateTag } = await import("next/cache")
            revalidateTag("analytics-data", "default")
            revalidateTag("launch-command-center", "default")
        } catch {
            /* ok outside Next runtime */
        }

        return NextResponse.json({ success: true, data: row })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 })
        }
        console.error("launch-progress-targets POST error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to save" },
            { status: 500 },
        )
    }
}
