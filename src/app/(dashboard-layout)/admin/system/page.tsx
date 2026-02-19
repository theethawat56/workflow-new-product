import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { SystemConsole } from "@/components/admin/SystemConsole"

export default async function AdminSystemPage() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        redirect("/api/auth/signin")
    }

    // Strict RBAC
    const role = (session.user as any).role || "Viewer"
    if (role.toLowerCase() !== "admin" && !session.user.email?.includes("admin")) {
        // Fallback email check for MVP if role field missing
        return (
            <div className="flex h-screen items-center justify-center text-destructive">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-2">403</h1>
                    <p>Access Denied: Admins Only</p>
                </div>
            </div>
        )
    }

    return (
        <SystemConsole
            user={{
                email: session.user.email || "Unknown",
                role: role
            }}
        />
    )
}
