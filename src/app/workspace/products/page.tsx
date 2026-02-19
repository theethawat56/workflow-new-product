
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { fetchSheet } from "@/lib/workspace/data-source"
import { Product } from "@/lib/workspace/types"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"

// Ensure dynamic rendering for fresh data
export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin")
    }

    // Direct data fetching (Server Component)
    const products = await fetchSheet<Product>("products")

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Products</h2>
                {/* Search is client-side implementation usually, simplified here or need Client Component */}
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => (
                    <Link key={product.sku_code} href={`/workspace/products/${product.sku_code}`}>
                        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <Badge variant={product.status === 'Active' ? 'default' : 'secondary'}>
                                        {product.status || 'Draft'}
                                    </Badge>
                                </div>
                                <CardTitle className="mt-2 text-lg line-clamp-1" title={product.product_name}>
                                    {product.product_name}
                                </CardTitle>
                                <div className="text-sm text-muted-foreground font-mono">
                                    {product.sku_code}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                    {product.brand} - {product.category}
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {products.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    No products found.
                </div>
            )}
        </div>
    )
}
