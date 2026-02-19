import { ProductList } from "@/components/products/ProductList"
import { findAll } from "@/lib/db/adapter"
import { SheetName } from "@/lib/db/schema"
import { AddExistingProductDialog } from "@/components/products/AddExistingProductDialog"

export const dynamic = 'force-dynamic'

export default async function OnSaleProductsPage() {
    const products = await findAll<any>("products" as SheetName)

    // Filter for launched products
    const launchedProducts = products.filter((p: any) => p.status === "Launched")

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto py-8 px-4 text-foreground">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Products on Sale</h1>
                    <p className="text-muted-foreground mt-1">Manage live products and track performance</p>
                </div>
                <AddExistingProductDialog />
            </div>

            <ProductList initialProducts={launchedProducts} isLaunchedView={true} />
        </div>
    )
}
