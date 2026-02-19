
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect, notFound } from "next/navigation"
import { getProductBySku, getProductExtendedInfo } from "@/lib/workspace/tools"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MessageSquare, ExternalLink } from "lucide-react"
import { ProductStatusEditor } from "@/components/products/ProductStatusEditor"

export default async function ProductDetailPage({ params }: { params: Promise<{ sku: string }> }) {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin")
    }

    const sku = (await params).sku
    const product = await getProductBySku(sku)

    if (!product) {
        notFound()
    }

    const extended = product.product_id ? await getProductExtendedInfo(product.product_id) : null

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/workspace/products">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold tracking-tight">{product.product_name}</h2>
                        <ProductStatusEditor productId={product.product_id!} currentStatus={product.status || 'Draft'} />
                    </div>
                    <p className="text-muted-foreground font-mono text-sm">{product.sku_code}</p>
                </div>

                <Link href={`/workspace/assistant?sku=${product.sku_code}`}>
                    <Button className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Ask AI
                    </Button>
                </Link>
            </div>

            {/* Content Grid */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <span className="font-semibold text-sm">Brand:</span> {product.brand}
                        </div>
                        <div>
                            <span className="font-semibold text-sm">Category:</span> {product.category}
                        </div>
                        {product.launch_date && (
                            <div>
                                <span className="font-semibold text-sm">Launch Date:</span> {product.launch_date}
                            </div>
                        )}
                        {product.price && (
                            <div>
                                <span className="font-semibold text-sm">Price:</span> {product.price}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {extended && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Key Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            {extended.target_customer && (
                                <div>
                                    <h4 className="font-semibold mb-1">Target Customer</h4>
                                    <p className="text-muted-foreground">{extended.target_customer}</p>
                                </div>
                            )}
                            {extended.key_features && (
                                <div>
                                    <h4 className="font-semibold mb-1">Key Features</h4>
                                    <p className="text-muted-foreground">{extended.key_features}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Raw Data</CardTitle>
                    <CardDescription>Debug information</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                        {JSON.stringify(product, null, 2)}
                    </pre>
                </CardContent>
            </Card>
        </div>
    )
}
