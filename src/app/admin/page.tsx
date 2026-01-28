import { findAll } from "@/lib/db/adapter"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsersTable } from "@/components/admin/UsersTable"
import { DatabaseManagementSection } from "@/components/admin/DatabaseManagementSection"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { requireAdmin } from "@/lib/db/permissions"
import { redirect } from "next/navigation"

export default async function AdminPage() {
    const session = await getServerSession(authOptions)
    if (!session) {
        redirect("/login")
    }

    // Enforce Admin Role
    await requireAdmin()

    const users = await findAll<any>("users")

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>

            <Tabs defaultValue="users">
                <TabsList>
                    <TabsTrigger value="users">User Management</TabsTrigger>
                    <TabsTrigger value="database">Database</TabsTrigger>
                </TabsList>
                <TabsContent value="users" className="mt-4">
                    <UsersTable users={users} />
                </TabsContent>
                <TabsContent value="database" className="mt-4">
                    <DatabaseManagementSection />
                </TabsContent>
            </Tabs>
        </div>
    )
}
