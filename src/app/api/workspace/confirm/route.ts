import { NextRequest, NextResponse } from "next/server"
import { confirmHandler } from "@/lib/workspace/orchestrator-core"
import { ConfirmRequest } from "@/lib/workspace/types"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json() as ConfirmRequest

        // Inject/Validate user session
        body.context = body.context || {}
        body.context.user = {
            email: session.user?.email || "unknown",
            role: session.user?.role || "Viewer"
        }

        const response = await confirmHandler(body)
        return NextResponse.json(response)
    } catch (error) {
        console.error("Confirm API Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
