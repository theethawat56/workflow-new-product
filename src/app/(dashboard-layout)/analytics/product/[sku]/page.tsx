import Link from "next/link"
import { notFound } from "next/navigation"
import { ProductDeepDiveDashboard } from "@/components/analytics/ProductDeepDiveDashboard"
import { loadProductDeepDive } from "@/lib/analytics/product-deep-dive"
import { ChevronLeft } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ProductDeepDivePage({
    params,
}: {
    params: Promise<{ sku: string }>
}) {
    const { sku } = await params
    const data = await loadProductDeepDive(decodeURIComponent(sku))
    if (!data) notFound()

    return (
        <div className="space-y-4">
            <Link
                href="/analytics"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
                <ChevronLeft className="w-4 h-4" />
                RobotMaker Analytics
            </Link>
            <p className="text-sm text-muted-foreground">
                Product Deep-Dive · เจาะลึกรายตัว — คลิก SKU จากหน้า analytics / sales
                เพื่อมาที่นี่
            </p>
            <ProductDeepDiveDashboard data={data} />
        </div>
    )
}
