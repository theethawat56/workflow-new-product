import { findAll } from "@/lib/db/adapter"
import { UsersTable } from "@/components/admin/UsersTable"
import { requireAdmin } from "@/lib/db/permissions"

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
    await requireAdmin()
    const users = await findAll<any>("users")
    return (
        <div className="container py-10">
            <h1 className="text-3xl font-bold mb-6">User Management</h1>
            <UsersTable users={users} />
        </div>
    )
}
