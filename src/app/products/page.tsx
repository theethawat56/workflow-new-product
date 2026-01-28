import { findAll } from "@/lib/db/adapter"
import { ProductList } from "@/components/products/ProductList"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Force dynamic
export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
    const products = await findAll<any>("products")

    return (
        <div className="container mx-auto py-10">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Products</h1>
                <Button asChild>
                    <Link href="/products/new">New Product</Link>
                </Button>
            </div>

            <ProductList initialProducts={products} />
        </div>
    )
}
