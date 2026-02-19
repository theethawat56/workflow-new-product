import { fetchSheet, queryByColumn } from "./data-source"
import { Product, Task, Attachment, SalesItem, ProductSummary } from "./types"

// --- Product Tools ---

export async function getProductBySku(sku: string): Promise<Product | null> {
    try {
        const products = await fetchSheet<Product>("products")
        const normalizedSku = sku.toLowerCase().trim()
        return products.find(p => p.sku_code?.toLowerCase() === normalizedSku) || null
    } catch (error) {
        console.error("Error in getProductBySku:", error)
        return null
    }
}

export async function searchProducts(query: string, limit: number = 5): Promise<any[]> {
    try {
        const products = await fetchSheet<Product>("products")
        const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, "")
        const lowerQuery = query.toLowerCase().trim()

        const candidates = products.map(p => {
            let score = 0
            const pSku = (p.sku_code || "").toLowerCase().trim()
            const pName = (p.product_name || "").toLowerCase().trim()
            const pNameNorm = pName.replace(/\s+/g, "")

            // Scoring Rules
            if (pSku === lowerQuery) {
                score = 100 // Exact SKU match
            } else if (pSku.includes(lowerQuery)) {
                score = 80 // SKU contains
            } else if (pName === lowerQuery) {
                score = 60 // Exact Name match
            } else if (pName.includes(lowerQuery)) {
                score = 40 // Name contains
            } else if (pNameNorm.includes(normalizedQuery)) {
                score = 20 // Normalized contains
            }

            return {
                sku: p.sku_code,
                productName: p.product_name,
                brand: p.brand,
                status: p.status,
                score
            }
        })
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)

        return candidates
    } catch (error) {
        console.error("Error in searchProducts:", error)
        return []
    }
}

// --- Task Tools ---

export async function listTasksByProduct(productId: string): Promise<Task[]> {
    try {
        // In-memory filter for now (MVP optimization)
        // Ideally we'd use queryByColumn but we want to be safe with casing
        const tasks = await fetchSheet<Task>("product_tasks")
        return tasks.filter(t => t.product_id === productId)
    } catch (error) {
        console.error("Error in listTasksByProduct:", error)
        return []
    }
}

export async function listTasksByAssignee(email: string): Promise<Task[]> {
    try {
        const tasks = await fetchSheet<Task>("product_tasks")
        const normalizedEmail = email.toLowerCase().trim()
        return tasks.filter(t => t.owner_email?.toLowerCase().trim() === normalizedEmail)
    } catch (error) {
        console.error("Error in listTasksByAssignee:", error)
        return []
    }
}

// --- Attachment Tools ---

export async function listAttachmentsByProduct(productId: string): Promise<Attachment[]> {
    try {
        const attachments = await fetchSheet<Attachment>("attachments")
        return attachments.filter(a => a.product_id === productId)
    } catch (error) {
        console.error("Error in listAttachmentsByProduct:", error)
        return []
    }
}

// --- Sales Tools ---

export async function querySalesBySku(sku: string, dateRange?: { start: Date, end: Date }): Promise<SalesItem[]> {
    try {
        // First get all sales (MVP warning: this might get large, strictly for MVP data sizes)
        // Optimization: In real app, we might need a better query strategy or DB
        const sales = await fetchSheet<SalesItem>("sale_order_items")
        const normalizedSku = sku.toLowerCase().trim()

        let filtered = sales.filter(s => s.sku?.toLowerCase().trim() === normalizedSku)

        if (dateRange) {
            filtered = filtered.filter(s => {
                const date = new Date(s.order_date)
                // Simple date validity check
                if (isNaN(date.getTime())) return false
                return date >= dateRange.start && date <= dateRange.end
            })
        }

        return filtered
    } catch (error) {
        console.error("Error in querySalesBySku:", error)
        return []
    }
}

// --- Admin Tools ---

export async function reportOrphanTasks() {
    try {
        const [products, tasks] = await Promise.all([
            fetchSheet<Product>("products"),
            fetchSheet<Task>("product_tasks")
        ])

        const productIds = new Set(products.map(p => p.product_id))

        const orphans = tasks.filter(t => !productIds.has(t.product_id))

        return {
            totalOrphans: orphans.length,
            orphans: orphans.slice(0, 100) // Return first 100 for details if needed
        }
    } catch (error) {
        console.error("Error in reportOrphanTasks:", error)
        return { totalOrphans: 0, orphans: [] }
    }
}

// --- Mutation Tools ---
import { updateTaskAction } from "@/app/actions/task"

export async function getTaskById(taskId: string): Promise<Task | null> {
    try {
        const tasks = await fetchSheet<Task>("product_tasks")
        return tasks.find(t => t.product_task_id === taskId) || null
    } catch (error) {
        return null
    }
}

export async function updateTaskStatusTool(taskId: string, unusedProductId: string, status: string) {
    try {
        // 1. Find the task to get definitive Product ID
        const task = await getTaskById(taskId)
        if (!task) {
            return { success: false, message: `Task ${taskId} not found` }
        }

        // 2. Call Action with correct Product ID
        const result = await updateTaskAction(taskId, task.product_id, { status })
        return result
    } catch (error) {
        return { success: false, message: String(error) }
    }
}

export async function updateTaskTool(taskId: string, changes: any) {
    try {
        const task = await getTaskById(taskId)
        if (!task) {
            return { success: false, message: `Task ${taskId} not found` }
        }
        return await updateTaskAction(taskId, task.product_id, changes)
    } catch (error) {
        return { success: false, message: String(error) }
    }
}
// --- Attachment Mutation Tools ---
import { addAttachmentAction } from "@/app/actions/attachment"

export async function addAttachmentTool(url: string, productId: string, taskId?: string, type: string = "link") {
    try {
        const result = await addAttachmentAction(productId, taskId || "", url, type)
        return result
    } catch (error) {
        return { success: false, message: String(error) }
    }
}


// --- Activity Logic Tools ---
import { logActivity } from "@/lib/logger"

export async function appendActivityLog(
    entityType: "product" | "product_task" | "attachment" | "user" | "sys_task_template",
    entityId: string,
    action: "create" | "update" | "delete",
    actorEmail: string,
    before: any = null,
    after: any = null
) {
    try {
        await logActivity(entityType, entityId, action, actorEmail, before, after)
        return { success: true }
    } catch (error) {
        console.error("Error in appendActivityLog:", error)
        return { success: false, message: String(error) }
    }
}

// --- Unified Search Tools ---

import { searchDriveFiles } from "@/lib/google/drive"

export interface SearchResults {
    products: any[]
    tasks: any[]
    files: any[]
}

export async function searchTasks(query: string, limit: number = 5): Promise<any[]> {
    try {
        const tasks = await fetchSheet<Task>("product_tasks")
        const lowerQuery = query.toLowerCase().trim()

        return tasks.filter(t => {
            const name = (t.task_name || "").toLowerCase()
            const status = (t.status || "").toLowerCase()
            const owner = (t.owner_email || "").toLowerCase()

            return name.includes(lowerQuery) ||
                status.includes(lowerQuery) ||
                owner.includes(lowerQuery)
        }).slice(0, limit)
    } catch (error) {
        console.error("Error searching tasks:", error)
        return []
    }
}

export async function searchWorkspace(query: string): Promise<SearchResults> {
    const [products, tasks, files] = await Promise.all([
        searchProducts(query),
        searchTasks(query),
        searchDriveFiles(query)
    ])

    return {
        products,
        tasks,
        files
    }
}
// --- Placeholder Tools ---
export async function launchProduct(sku: string) {
    return { success: true, message: `Launch sequence initiated for ${sku}` }
}

// --- Checklist Mutation Tools ---

import { createTasksBatchAction } from "@/app/actions/checklist"

export async function createTasksBatchTool(productId: string, tasks: any[]) {
    try {
        return await createTasksBatchAction(productId, tasks)
    } catch (error) {
        return { success: false, message: String(error) }
    }
}
