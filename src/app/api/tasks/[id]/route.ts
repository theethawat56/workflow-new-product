
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateTaskTool } from "@/lib/workspace/tools";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = (await params).id;

    try {
        const body = await request.json();
        const result = await updateTaskTool(id, body);

        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
