import { fetchSheet } from "@/lib/workspace/data-source"

/**
 * Build SKU → display name from products, launched_products, and sales_orders.
 * Later sources do not overwrite earlier non-empty names (products first).
 */
export async function buildSkuProductNameMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>()

    const setName = (sku: string | undefined, name: string | undefined) => {
        const key = (sku ?? "").trim()
        const label = (name ?? "").trim()
        if (!key || !label || map.has(key)) return
        map.set(key, label)
    }

    const [products, launched, orders] = await Promise.all([
        fetchSheet<{
            sku_code?: string
            product_name?: string
        }>("products").catch(() => []),
        fetchSheet<{
            zort_sku?: string
            product_name?: string
        }>("launched_products").catch(() => []),
        fetchSheet<{
            sku?: string
            product_name?: string
        }>("sales_orders").catch(() => []),
    ])

    for (const p of products) {
        setName(p.sku_code, p.product_name)
    }
    for (const lp of launched) {
        setName(lp.zort_sku, lp.product_name)
    }
    for (const row of orders) {
        setName(row.sku, row.product_name)
    }

    return map
}

export function resolveProductName(
    sku: string,
    nameMap: Map<string, string>,
): string {
    const key = sku.trim()
    return nameMap.get(key) ?? key
}
