import { ChatInterface } from "@/components/workspace/ChatInterface"
import { Metadata } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
    title: "Workspace | LaunchFlow",
    description: "Chat-based product management workspace",
}

export default async function WorkspacePage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin?callbackUrl=/workspace")
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
            <ChatInterface
                userRole={session.user?.role || "Viewer"}
                userEmail={session.user?.email || ""}
            />
        </div>
    )
}
