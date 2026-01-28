import { findOne, findAll } from "@/lib/db/adapter"
import { ProductDetailView } from "@/components/products/ProductDetailView"
import { notFound } from "next/navigation"

export const dynamic = 'force-dynamic'

interface Props {
    params: Promise<{
        product_id: string
    }>
}

export default async function ProductDetailPage(props: Props) {
    const params = await props.params
    const { product_id } = params

    const product = await findOne<any>("products", "product_id", product_id)

    if (!product) {
        notFound()
    }

    // Fetch related data
    const tasks = await findAll<any>("product_tasks")
    const productTasks = tasks.filter(t => t.product_id === product_id)

    const attachments = await findAll<any>("attachments")
    const productAttachments = attachments.filter(a => a.product_id === product_id)

    return (
        <div className="container mx-auto py-10">
            <ProductDetailView
                product={product}
                tasks={productTasks}
                attachments={productAttachments}
            />
        </div>
    )
}
