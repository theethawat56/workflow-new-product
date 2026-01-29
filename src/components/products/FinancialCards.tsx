"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "next-auth/react"

interface Props {
    product: any
}

export function FinancialCards({ product }: Props) {
    const { data: session } = useSession()
    const role = session?.user?.role

    const hideFinancials = role === 'CS' || role === 'AfterService'

    if (hideFinancials) return null

    return (
        <>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">GP %</CardTitle></CardHeader>
                <CardContent className="font-bold text-lg text-green-600">
                    {product.gp_pct ? `${Number(product.gp_pct).toFixed(2)}%` : "N/A"}
                </CardContent>
            </Card>
        </>
    )
}

export function CostPriceCard({ product }: Props) {
    const { data: session } = useSession()
    const role = session?.user?.role
    const hideFinancials = role === 'CS' || role === 'AfterService'

    if (hideFinancials) return null

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <div><strong>Cost:</strong> {product.cost}</div>
                <div><strong>Price:</strong> {product.price}</div>
            </CardContent>
        </Card>
    )
}
