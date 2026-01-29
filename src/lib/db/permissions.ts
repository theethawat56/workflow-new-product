import { findOne } from "@/lib/db/adapter"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { redirect } from "next/navigation"

export async function getCurrentUser() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return null

    // Fetch user from DB
    const user = await findOne<any>("users", "email", session.user.email)
    return user
}

export async function requireAdmin() {
    const session = await getServerSession(authOptions)

    // Debug log to see what's happening on server
    console.log("requireAdmin check:", {
        email: session?.user?.email,
        role: session?.user?.role
    })

    if (!session || session.user.role !== "Admin") {
        redirect("/dashboard?error=Unauthorized")
    }
}
