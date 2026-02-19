import { searchProducts, resolveSku, getProductBySku, listPendingTasks as originalListPendingTasks } from "./tools"
import { searchTasks, searchDriveFiles } from "./tools"

// --- Tool Definitions for LLM ---

export async function search_db({ query, limit = 5 }: { query: string, limit?: number }) {
    try {
        // Unified search wrapper
        // We'll prioritize Products > Tasks > Files
        const products = await searchProducts(query, limit)

        // Map to requested schema: { hits: [{source_sheet, id, sku, title, snippet, score}] }
        const hits = []

        for (const p of products) {
            hits.push({
                source_sheet: "products",
                id: p.sku || p.sku_code, // Use SKU as ID for products
                sku: p.sku || p.sku_code,
                title: p.productName || p.product_name,
                snippet: `Status: ${p.status}, Brand: ${p.brand}`,
                score: p.score
            })
        }

        // If we have room, search other sources
        if (hits.length < limit) {
            const tasks = await searchTasks(query, limit - hits.length)
            for (const t of tasks) {
                hits.push({
                    source_sheet: "product_tasks",
                    id: t.product_task_id,
                    sku: t.sku || t.product_sku,
                    title: t.task_name || t.task_title,
                    snippet: `Status: ${t.status}, Owner: ${t.owner_email}`,
                    score: 80 // Placeholder score for secondary matches
                })
            }
        }

        return { hits: hits.slice(0, limit) }

    } catch (e) {
        console.error("search_db error:", e)
        return { hits: [] }
    }
}

export async function resolve_product({ query }: { query: string }) {
    try {
        const result = await resolveSku(query)

        if (result.sku) {
            // Re-fetch details to get name
            const product = await getProductBySku(result.sku)
            return {
                status: "single",
                product: {
                    sku: result.sku,
                    name: product?.product_name || result.sku
                }
            }
        } else if (result.candidates) {
            return {
                status: "multiple",
                candidates: result.candidates.map(c => ({
                    sku: c.sku,
                    name: c.name,
                    status: c.status || "Unknown",
                    score: c.score
                }))
            }
        }

        return { status: "none" }

    } catch (e) {
        console.error("resolve_product error:", e)
        return { status: "none", error: String(e) }
    }
}

export async function get_product_summary({ sku }: { sku: string }) {
    try {
        const product = await getProductBySku(sku)
        if (!product) return { error: "Product not found" }

        // Fetch extended info (Key Features, Target Customer, SpecSheet) from tasks
        const extendedInfo = await import("./tools").then(m => m.getProductExtendedInfo(product.product_id))

        return {
            sku: product.sku_code,
            name: product.product_name,
            status: product.status,
            price: product.price,
            brand: product.brand,
            category: product.category,
            // Extended Data
            key_features: extendedInfo?.key_features || "Not specified",
            target_customer: extendedInfo?.target_customer || "Not specified",
            spec_sheet: extendedInfo?.spec_sheet || "Not available",
            full_data: product // Allow LLM to read other fields if needed
        }
    } catch (e) {
        return { error: String(e) }
    }
}

export async function list_pending_tasks({ sku, page = 1, page_size = 5 }: { sku?: string, page?: number, page_size?: number }) {
    try {
        const result = await originalListPendingTasks({
            sku,
            page,
            pageSize: page_size
        })

        return {
            sku: result.stats.resolvedSku || sku,
            total_pending: result.total,
            stats: result.stats,
            items: result.tasks.map(t => ({
                task_id: t.product_task_id,
                title: t.task_name,
                status: t.status,
                due_date: t.due_date,
                assignee: t.owner_email,
                priority: t.priority,
                note: (t as any).notes || ""
            }))
        }
    } catch (e) {
        return { error: String(e) }
    }
}

const GEMINI_TOOLS_SCHEMA = [
    {
        name: "search_db",
        description: "Search for products, tasks, or files in the database.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING" },
                limit: { type: "NUMBER" }
            },
            required: ["query", "limit"]
        }
    },
    {
        name: "resolve_product",
        description: "Resolve a vague product name or query to a specific SKU.",
        parameters: {
            type: "OBJECT",
            properties: {
                query: { type: "STRING" }
            },
            required: ["query"]
        }
    },
    {
        name: "get_product_summary",
        description: "Get detailed information about a specific product by SKU.",
        parameters: {
            type: "OBJECT",
            properties: {
                sku: { type: "STRING" }
            },
            required: ["sku"]
        }
    },
    {
        name: "list_pending_tasks",
        description: "List pending tasks. If 'sku' is provided, filters by that SKU. If omitted, lists all pending tasks (or tasks for the current context).",
        parameters: {
            type: "OBJECT",
            properties: {
                sku: { type: "STRING", description: "Optional SKU to filter by." },
                page: { type: "NUMBER" },
                page_size: { type: "NUMBER" }
            },
            required: ["page", "page_size"]
        }
    }
]

export { GEMINI_TOOLS_SCHEMA }
