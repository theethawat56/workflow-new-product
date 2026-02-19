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

export async function getProductExtendedInfo(productId: string) {
    try {
        const allTasks = await fetchSheet<Task>("product_tasks")
        const productTasks = allTasks.filter(t => t.product_id === productId)

        const getKeyNote = (key: string) => {
            const task = productTasks.find(t => (t.task_name || "").toLowerCase().includes(key.toLowerCase()))
            return task ? (task as any).notes : null
        }

        return {
            key_features: getKeyNote("Key Feature"),
            target_customer: getKeyNote("Target Customer"),
            spec_sheet: getKeyNote("SpecSheet") || getKeyNote("Spec Sheet")
        }
    } catch (e) {
        console.error("Error getting extended info:", e)
        return null
    }
}

// --- Task Tools ---

// Helper: Normalize Thai Command (for reference/usage in other tools if needed)
export function normalizeThaiCommand(text: string): string {
    return text.trim().toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/งานค่าง/g, "งานค้าง")
        .replace(/ค่าง/g, "ค้าง")
        .replace(/[?.!]+$/, "")
}

// 5) SKU Resolution
export async function resolveSku(input: string): Promise<{ sku?: string, productId?: string, candidates?: any[], error?: string }> {
    try {
        const products = await fetchSheet<Product>("products")
        const normalizedInput = input.trim()
        const lowerInput = normalizedInput.toLowerCase()

        // 1. Exact/Pattern SKU Match
        const skuMatch = products.find(p => p.sku_code?.trim().toLowerCase() === lowerInput)
        if (skuMatch) return { sku: skuMatch.sku_code, productId: skuMatch.product_id }

        // 2. Product Name Search
        const candidates = products.filter(p => {
            const name = (p.product_name || "").toLowerCase()
            return name.includes(lowerInput)
        }).map(p => ({
            sku: p.sku_code,
            productId: p.product_id,
            name: p.product_name,
            score: p.product_name?.toLowerCase() === lowerInput ? 100 : 50
        })).sort((a, b) => b.score - a.score)

        if (candidates.length === 1) {
            return { sku: candidates[0].sku, productId: candidates[0].productId }
        } else if (candidates.length > 1) {
            return { candidates }
        }

        return { error: "not_found" }

    } catch (error) {
        console.error("Error in resolveSku:", error)
        return { error: String(error) }
    }
}

// 3) & 4) Robust Sheet Reading
async function getTasksSheet(): Promise<{ tasks: any[], source: string }> {
    // Try template_tasks first
    try {
        const templateTasks = await fetchSheet<any>("template_tasks")
        // Check for instance indicators: status column
        const hasStatus = templateTasks.length > 0 && Object.keys(templateTasks[0]).some(k =>
            ["status", "state", "สถานะ"].includes(k.toLowerCase())
        )

        if (hasStatus) {
            return { tasks: templateTasks, source: "template_tasks" }
        }
    } catch (e) {
        // template_tasks might not exist
    }

    // Fallback order
    const fallbacks = ["product_tasks", "tasks"]
    for (const sheetName of fallbacks) {
        try {
            // @ts-ignore - dynamic fallback
            const tasks = await fetchSheet<any>(sheetName)
            if (tasks.length > 0) return { tasks, source: sheetName }
        } catch (e) {
            // continue
        }
    }

    // If nothing found or only template_tasks (without status) exists
    try {
        const templateTasks = await fetchSheet<any>("template_tasks")
        return { tasks: templateTasks, source: "template_tasks (template)" }
    } catch (e) {
        return { tasks: [], source: "none" }
    }
}

export async function listPendingTasks(options: {
    sku?: string,
    page?: number,
    pageSize?: number
} = {}) {
    try {
        const { sku, page = 1, pageSize = 10 } = options

        // 1. Resolve Product ID (if SKU provided)
        let targetProductId: string | undefined
        let resolvedSku = sku
        let resolutionError = null

        if (sku) {
            const resolution = await resolveSku(sku)
            if (resolution.productId) {
                targetProductId = resolution.productId
                resolvedSku = resolution.sku
            } else if (resolution.candidates) {
                // Ambiguous
                return { tasks: [], total: 0, hasMore: false, stats: { total: 0, byStatus: {}, overdue: 0, ambiguous: resolution.candidates } }
            } else {
                // Not found via Products
                // We will still try to filter by SKU column if explicit
                resolutionError = "not_found_in_products"
            }
        }

        // 2. Fetch Tasks AND Products (Always product_tasks for pending/working tasks)
        // Requirement: "Always query from product_tasks (NOT template_tasks)"
        const allTasks = await fetchSheet<Task>("product_tasks")

        // Column Mapping Helpers
        const getCol = (item: any, candidates: string[]) => {
            const key = Object.keys(item).find(k => candidates.includes(k.toLowerCase().trim()))
            return key ? item[key] : undefined
        }

        // 3. Filter
        const pendingStatuses = new Set(["todo", "doing", "blocked", "waiting", "pending", "not started", "notstarted", "open", "working", "inprogress", "in progress", "รอดำเนินการ", "กำลังทำ", "ติดปัญหา", ""])
        const nonPendingStatuses = new Set(["done", "canceled", "cancelled", "completed", "closed", "finish", "finished", "ยกเลิก", "เสร็จ", "success"])

        let filtered = allTasks.filter(t => {
            // Status Check
            const statusVal = getCol(t, ["status", "state", "สถานะ"]) || ""
            const s = String(statusVal).toLowerCase().trim()

            // If explicit non-pending => REMOVE (e.g. Done)
            if (nonPendingStatuses.has(s)) return false
            // If explicit pending (e.g. TODO) OR empty => KEEP

            // Scope Check
            if (targetProductId) {
                // Filter by Product ID if resolved
                if (t.product_id !== targetProductId) return false
            } else if (sku && !targetProductId) {
                // Fallback: Filter by SKU column if we couldn't resolve Product ID
                const skuVal = getCol(t, ["sku", "product_sku", "code", "รหัสสินค้า"]) || ""
                if (String(skuVal).toLowerCase().trim() !== sku.toLowerCase().trim()) return false
            }

            return true
        })

        // 4. Compute Stats
        const totalPending = filtered.length
        const statusCounts: Record<string, number> = {}
        let overdueCount = 0
        const now = new Date()

        const mappedTasks = filtered.map(t => {
            const statusVal = getCol(t, ["status", "state", "สถานะ"]) || "TODO" // Default empty to TODO
            const dueVal = getCol(t, ["due_date", "due", "deadline", "target_date", "กำหนด", "วันครบกำหนด"])
            const taskTitle = getCol(t, ["task_title", "task_name", "title", "name", "งาน", "task"]) || "Untitled Task"
            const priorityVal = getCol(t, ["priority", "prio", "ความสำคัญ"]) || "Medium"
            const ownerRole = getCol(t, ["owner_role", "role", "ผู้รับผิดชอบ"])
            const ownerEmail = getCol(t, ["owner_email", "email"])

            statusCounts[statusVal] = (statusCounts[statusVal] || 0) + 1

            let isOverdue = false
            let dueDateObj = null

            if (dueVal) {
                const due = new Date(dueVal)
                if (!isNaN(due.getTime())) {
                    dueDateObj = due
                    if (due < now) {
                        overdueCount++
                        isOverdue = true
                    }
                }
            }

            return {
                ...t,
                _valid_title: taskTitle,
                _valid_status: statusVal,
                _valid_priority: priorityVal,
                _valid_due_date: dueDateObj,
                _is_overdue: isOverdue,
                _valid_owner_role: ownerRole,
                _valid_owner_email: ownerEmail
            }
        })

        // 5. Sort
        const pScore = (p: string) => {
            const low = String(p).toLowerCase()
            if (low === "high" || low === "critical" || low === "สูง") return 3
            if (low === "medium" || low === "กลาง") return 2
            return 1
        }

        mappedTasks.sort((a, b) => {
            // Overdue first
            if (a._is_overdue && !b._is_overdue) return -1
            if (!a._is_overdue && b._is_overdue) return 1

            // Due Date (ASC)
            const aDate = a._valid_due_date ? a._valid_due_date.getTime() : Number.MAX_SAFE_INTEGER
            const bDate = b._valid_due_date ? b._valid_due_date.getTime() : Number.MAX_SAFE_INTEGER
            if (aDate !== bDate) return aDate - bDate

            // Priority (DESC)
            return pScore(b._valid_priority) - pScore(a._valid_priority)
        })

        // 6. Paginate
        const start = (page - 1) * pageSize
        const end = start + pageSize
        const pagedTasks = mappedTasks.slice(start, end)

        // Standardize
        const standardTasks = pagedTasks.map(t => ({
            ...t,
            task_name: t._valid_title,
            status: t._valid_status,
            due_date: t._valid_due_date ? t._valid_due_date.toISOString() : null,
            priority: t._valid_priority,
            owner_role: t._valid_owner_role,
            owner_email: t._valid_owner_email,
            product_id: t.product_id || targetProductId
        }))

        return {
            tasks: standardTasks,
            total: totalPending,
            hasMore: end < totalPending,
            stats: {
                total: totalPending,
                byStatus: statusCounts,
                overdue: overdueCount,
                source: "product_tasks", // Explicit source as requested
                resolvedSku: resolvedSku,
                resolvedProductId: targetProductId,
                resolutionError
            }
        }

    } catch (error) {
        console.error("Error in listPendingTasks:", error)
        return { tasks: [], total: 0, hasMore: false, stats: { total: 0, byStatus: {}, overdue: 0 } }
    }
}

export async function listTasksBySku(sku: string): Promise<Task[]> {
    try {
        const tasks = await fetchSheet<Task>("product_tasks")
        const normalizedSku = sku.toLowerCase().trim()

        return tasks.filter(t => {
            // Check 'sku' column first, if not exists check if we can link via product_id?
            // For now, assuming 'sku' column exists as per Checklist Agent requirements.
            // If the sheet doesn't have 'sku', we might need to join with products, but let's assume it does.
            const taskSku = (t.sku || "").toLowerCase().trim()
            return taskSku === normalizedSku
        })
    } catch (error) {
        console.error("Error in listTasksBySku:", error)
        return []
    }
}

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
export { searchDriveFiles }

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
