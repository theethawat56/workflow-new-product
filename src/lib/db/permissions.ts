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
    const user = await getCurrentUser()

    // If no user found in DB, arguably they have no role. 
    // BUT for bootstrapping, maybe first user is Admin? 
    // Logic: If users sheet is empty, allow? No, `init` handles seeding.
    // If user not in DB, they are not Admin.

    if (!user || user.role !== "Admin") {
        redirect("/dashboard?error=Unauthorized")
    }
}
