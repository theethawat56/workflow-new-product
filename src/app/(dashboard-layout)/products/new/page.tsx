import { NewProductForm } from "@/components/products/NewProductForm"
import { findAll } from "@/lib/db/adapter"
import { SheetName } from "@/lib/db/schema"

// Force dynamic to ensure we get fresh data
export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
    const users = await findAll<any>("users")
    const roleDefaults = await findAll<any>("role_defaults")

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Create New Product</h1>
            <NewProductForm users={users} roleDefaults={roleDefaults} />
        </div>
    )
}
