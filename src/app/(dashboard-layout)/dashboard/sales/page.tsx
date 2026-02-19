import { SalesDashboard } from "@/components/dashboard/sales-dashboard"
import { findAll } from "@/lib/db/adapter"
import { SheetName } from "@/lib/db/schema"

export const dynamic = 'force-dynamic'

export default async function SalesPage() {
    const saleData = await findAll<any>("sales_all" as SheetName)
    const launchedProducts = await findAll<any>("launched_products" as SheetName)
    const products = await findAll<any>("products" as SheetName)

    return <SalesDashboard initialData={saleData} launchedProducts={launchedProducts} products={products} />
}
