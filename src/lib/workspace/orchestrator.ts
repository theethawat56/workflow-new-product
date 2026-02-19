import { Message, WorkspaceState } from "./types"
import * as tools from "./tools"
import { getProductBySku } from "./tools"

type Intent =
    | { type: 'SEARCH_PRODUCT'; query: string }
    | { type: 'LIST_TASKS'; sku?: string; mine?: boolean }
    | { type: 'GET_DETAILS'; sku?: string }
    | { type: 'SALES_SUMMARY'; sku?: string; days?: number }
    | { type: 'ADMIN_REPORT_ORPHAN_TASKS' }
    | { type: 'UPDATE_TASK_STATUS'; taskId: string; status: string }
    | { type: 'ASSIGN_TASK'; taskId: string; email: string }
    | { type: 'SET_DUE_DATE'; taskId: string; date: string }
    | { type: 'BLOCK_TASK'; taskId: string; reason: string }
    | { type: 'ADD_ATTACHMENT'; url: string; sku?: string; taskId?: string }
    | { type: 'EXECUTE_ACTION'; payload: any }
    | { type: 'UNKNOWN' }

function determineIntent(content: string, context: WorkspaceState): Intent {
    const lower = content.toLowerCase().trim()

    // 1. Search / Find
    if (lower.startsWith('find') || lower.startsWith('search')) {
        const query = lower.replace(/^(find product|find|search)\s+/, '').trim()
        return { type: 'SEARCH_PRODUCT', query }
    }

    // 2. My Tasks
    if (lower === 'my tasks' || lower === 'tasks assigned to me') {
        return { type: 'LIST_TASKS', mine: true }
    }

    // 3. Tasks for SKU (or current)
    if (lower.startsWith('tasks') || lower.includes('tasks for')) {
        const skuMatch = lower.match(/(?:for|show)\s+([a-zA-Z0-9-]+)/)
        const explicitSku = skuMatch ? skuMatch[1] : undefined
        return { type: 'LIST_TASKS', sku: explicitSku }
    }

    // 4. Details / Open (or current)
    if (lower.startsWith('open') || lower.startsWith('show details') || lower === 'details') {
        const skuMatch = lower.match(/(?:for|open|details)\s+([a-zA-Z0-9-]+)/)
        const explicitSku = skuMatch ? skuMatch[1] : undefined
        return { type: 'GET_DETAILS', sku: explicitSku }
    }

    // 5. Sales Summary
    if (lower.includes('sales') || lower.includes('performance')) {
        const skuMatch = lower.match(/(?:for|of)\s+([a-zA-Z0-9-]+)/)
        const explicitSku = skuMatch ? skuMatch[1] : undefined
        return { type: 'SALES_SUMMARY', sku: explicitSku, days: 30 } // Default 30 days
    }

    // 6. Admin: Orphan Tasks
    if (lower.includes('orphan') || (lower.includes('report') && lower.includes('task'))) {
        return { type: 'ADMIN_REPORT_ORPHAN_TASKS' }
    }

    // 7. Update Task Status (Mutation)
    // Pattern: "mark task [ID] as [STATUS]" or "set task [ID] to [STATUS]"
    if (lower.startsWith('mark task') || lower.startsWith('set task')) {
        const doneMatch = lower.match(/(?:mark|set) task ([a-zA-Z0-9-]+) (?:as|to) (done|completed|in progress|blocked)/)
        if (doneMatch) {
            const taskId = doneMatch[1]
            let status = doneMatch[2]

            // Normalize status
            if (status === 'completed') status = 'Done'
            if (status === 'done') status = 'Done'
            if (status === 'in progress') status = 'InProgress'
            if (status === 'blocked') status = 'Blocked'
            // Case sensitive for backend: Done, InProgress, Blocked, NotStarted
            if (status === 'Done') status = 'Done'
            if (status === 'InProgress') status = 'InProgress'
            if (status === 'Blocked') status = 'Blocked'

            return { type: 'UPDATE_TASK_STATUS', taskId, status }
        }
    }

    // 8. Assign Task
    // Pattern: "assign task [ID] to [EMAIL]"
    if (lower.startsWith('assign task')) {
        const assignMatch = lower.match(/assign task ([a-zA-Z0-9-]+) to (\S+@\S+\.\S+)/)
        if (assignMatch) {
            return { type: 'ASSIGN_TASK', taskId: assignMatch[1], email: assignMatch[2] }
        }
    }

    // 9. Set Due Date
    // Pattern: "set due date for [ID] to [DATE]"
    if (lower.startsWith('set due date') || lower.startsWith('update due date')) {
        const dateMatch = lower.match(/(?:set|update) due date (?:for|of) ([a-zA-Z0-9-]+) to (.+)/)
        if (dateMatch) {
            return { type: 'SET_DUE_DATE', taskId: dateMatch[1], date: dateMatch[2] }
        }
    }

    // 10. Block Task
    // Pattern: "block task [ID] because [REASON]"
    if (lower.startsWith('block task')) {
        const blockMatch = lower.match(/block task ([a-zA-Z0-9-]+) (?:because|due to|reason) (.+)/)
        if (blockMatch) {
            return { type: 'BLOCK_TASK', taskId: blockMatch[1], reason: blockMatch[2] }
        }
    }

    // 11. Add Attachment
    // Pattern: "attach [URL] ..." or "add link [URL] ..."
    if (lower.startsWith('attach') || lower.startsWith('add link') || lower.startsWith('add attachment')) {
        const urlMatch = content.match(/https?:\/\/[^\s]+/)
        if (urlMatch) {
            const url = urlMatch[0]
            // Try to find context
            let sku = undefined
            let taskId = undefined

            const skuMatch = lower.match(/(?:to|for) product ([a-zA-Z0-9-]+)/)
            if (skuMatch) sku = skuMatch[1]

            const taskMatch = lower.match(/(?:to|for) task ([a-zA-Z0-9-]+)/)
            // If task is found, we might need to look up the product for that task if not provided.
            // But orchestrator logic can handle that in the confirmation step or prompt.
            if (taskMatch) taskId = taskMatch[1]

            return { type: 'ADD_ATTACHMENT', url, sku, taskId }
        }
    }

    // 12. Execute Action (System Internal)
    if (content.startsWith('EXECUTE_ACTION ')) {
        const payloadStr = content.replace('EXECUTE_ACTION ', '')
        try {
            const payload = JSON.parse(payloadStr)
            return { type: 'EXECUTE_ACTION', payload }
        } catch (e) {
            console.error("Failed to parse execute action payload")
        }
    }

    // Default: if it looks like a SKU (e.g. "PRD-123"), treat as open
    if (/^[a-zA-Z0-9-]{4,}$/.test(lower)) {
        return { type: 'GET_DETAILS', sku: lower }
    }

    // Default: if unrelated, treat as search
    if (lower.length > 2) {
        return { type: 'SEARCH_PRODUCT', query: lower }
    }

    return { type: 'UNKNOWN' }
}

export async function orchestrate(content: string, context: WorkspaceState): Promise<Message> {
    const intent = determineIntent(content, context)
    const id = Date.now().toString()
    const timestamp = new Date()

    try {
        switch (intent.type) {
            case 'SEARCH_PRODUCT': {
                const results = await tools.searchProducts(intent.query)
                if (results.length === 0) {
                    return {
                        id,
                        role: 'system',
                        content: `I couldn't find any products matching "${intent.query}".`,
                        type: 'text',
                        timestamp
                    }
                }
                return {
                    id,
                    role: 'system',
                    content: `Found ${results.length} products matching "${intent.query}":`,
                    type: 'product_card',
                    data: results,
                    timestamp
                }
            }
            case 'LIST_TASKS': {
                let tasks = []
                let message = ""

                if (intent.mine && context.currentUserEmail) {
                    tasks = await tools.listTasksByAssignee(context.currentUserEmail)
                    message = `Here are tasks assigned to you (${tasks.length}):`
                } else {
                    const sku = intent.sku || context.currentSku
                    if (!sku) {
                        return {
                            id, role: 'system', content: "Please specify a product SKU to see tasks.", type: 'text', timestamp
                        }
                    }
                    const product = await tools.getProductBySku(sku)
                    if (!product) {
                        return { id, role: 'system', content: `Product not found: ${sku}`, type: 'text', timestamp }
                    }
                    tasks = await tools.listTasksByProduct(product.product_id)
                    message = `Here are tasks for ${sku} (${tasks.length}):`
                }

                return {
                    id,
                    role: 'system',
                    content: message,
                    type: 'task_list',
                    data: tasks,
                    timestamp
                }
            }
            case 'GET_DETAILS': {
                const sku = intent.sku || context.currentSku
                if (!sku) {
                    return { id, role: 'system', content: "Please specify a product SKU to open.", type: 'text', timestamp }
                }

                const product = await tools.getProductBySku(sku)
                if (!product) {
                    return { id, role: 'system', content: `Product not found: ${sku}`, type: 'text', timestamp }
                }

                return {
                    id,
                    role: 'system',
                    content: `Opened details for ${product.product_name}.`,
                    type: 'text',
                    data: product,
                    timestamp,
                    contextUpdates: { currentSku: product.sku_code } // Update Context
                }
            }
            case 'SALES_SUMMARY': {
                const sku = intent.sku || context.currentSku
                if (!sku) {
                    return { id, role: 'system', content: "Please specify a product SKU for sales.", type: 'text', timestamp }
                }

                // Calculate date range (last 30 days)
                const end = new Date()
                const start = new Date()
                start.setDate(end.getDate() - (intent.days || 30))

                const sales = await tools.querySalesBySku(sku, { start, end })

                // Simple aggregation
                const totalAmount = sales.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0)
                const totalQty = sales.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)

                return {
                    id,
                    role: 'system',
                    content: `Sales summary for ${sku} (Last 30 days):`,
                    type: 'sales_summary',
                    data: {
                        sku,
                        totalAmount,
                        totalQty,
                        orderCount: sales.length,
                        period: "Last 30 Days"
                    },
                    timestamp
                }
            }
            case 'ADMIN_REPORT_ORPHAN_TASKS': {
                if (context.currentUserRole !== 'Admin') {
                    return {
                        id,
                        role: 'system',
                        content: "Access Denied: This command is reserved for administrators.",
                        type: 'error',
                        timestamp
                    }
                }

                const report = await tools.reportOrphanTasks()

                return {
                    id,
                    role: 'system',
                    content: `**Orphan Task Report**\n\nFound **${report.totalOrphans}** tasks with invalid Product IDs (orphans).\n\n${report.orphans.length > 0 ? "Sample orphans:\n" + report.orphans.map(t => `- ${t.task_name} (ID: ${t.product_task_id})`).join('\n') : "No orphans found."}`,
                    type: 'text',
                    timestamp
                }
            }
            case 'UPDATE_TASK_STATUS': {
                return {
                    id,
                    role: 'system',
                    content: "Please confirm this action.",
                    type: 'confirmation_request',
                    timestamp,
                    data: {
                        actionType: 'UPDATE_TASK',
                        summary: `Update Task Status`,
                        description: `Are you sure you want to change status of task ${intent.taskId} to ${intent.status}?`,
                        payload: {
                            action: 'updateTask',
                            taskId: intent.taskId,
                            changes: { status: intent.status }
                        }
                    }
                }
            }
            case 'ASSIGN_TASK': {
                return {
                    id,
                    role: 'system',
                    content: "Please confirm assignment.",
                    type: 'confirmation_request',
                    timestamp,
                    data: {
                        actionType: 'UPDATE_TASK',
                        summary: `Assign Task`,
                        description: `Are you sure you want to assign task ${intent.taskId} to ${intent.email}?`,
                        payload: {
                            action: 'updateTask',
                            taskId: intent.taskId,
                            changes: { owner_email: intent.email }
                        }
                    }
                }
            }
            case 'SET_DUE_DATE': {
                // Simple date parsing for MVP
                let dateStr = intent.date
                // Basic relative date handling
                if (dateStr.includes('tomorrow')) {
                    const d = new Date()
                    d.setDate(d.getDate() + 1)
                    dateStr = d.toISOString().split('T')[0]
                } else if (dateStr.includes('today')) {
                    dateStr = new Date().toISOString().split('T')[0]
                }

                return {
                    id,
                    role: 'system',
                    content: "Please confirm due date update.",
                    type: 'confirmation_request',
                    timestamp,
                    data: {
                        actionType: 'UPDATE_TASK',
                        summary: `Set Due Date`,
                        description: `Are you sure you want to set due date for task ${intent.taskId} to ${dateStr}?`,
                        payload: {
                            action: 'updateTask',
                            taskId: intent.taskId,
                            changes: { due_date: dateStr }
                        }
                    }
                }
            }
            case 'BLOCK_TASK': {
                return {
                    id,
                    role: 'system',
                    content: "Please confirm blocking task.",
                    type: 'confirmation_request',
                    timestamp,
                    data: {
                        actionType: 'UPDATE_TASK',
                        summary: `Block Task`,
                        description: `Are you sure you want to mark task ${intent.taskId} as BLOCKED because: "${intent.reason}"?`,
                        payload: {
                            action: 'updateTask',
                            taskId: intent.taskId,
                            changes: {
                                status: 'Blocked',
                                blocker_reason: intent.reason
                            }
                        }
                    }
                }
            }
            case 'ADD_ATTACHMENT': {
                // Resolve Product ID
                let productId = ""
                let description = ""

                if (intent.taskId) {
                    const task = await tools.getTaskById(intent.taskId)
                    if (task) {
                        productId = task.product_id
                        description = `Attach ${intent.url} to Task ${intent.taskId}?`
                    } else {
                        return { id, role: 'system', content: `Task ${intent.taskId} not found.`, type: 'error', timestamp }
                    }
                } else if (intent.sku) {
                    const product = await tools.getProductBySku(intent.sku)
                    if (product) {
                        productId = product.product_id
                        description = `Attach ${intent.url} to Product ${intent.sku}?`
                    } else {
                        return { id, role: 'system', content: `Product ${intent.sku} not found.`, type: 'error', timestamp }
                    }
                } else if (context.currentSku) {
                    const product = await tools.getProductBySku(context.currentSku)
                    if (product) {
                        productId = product.product_id
                        description = `Attach ${intent.url} to current Product ${context.currentSku}?`
                    }
                }

                if (!productId) {
                    return { id, role: 'system', content: "Please specify a product or task to attach this to.", type: 'text', timestamp }
                }

                return {
                    id, role: 'system', content: "Please confirm attachment.", type: 'confirmation_request', timestamp,
                    data: {
                        actionType: 'ADD_ATTACHMENT',
                        summary: "Add Attachment",
                        description,
                        payload: {
                            action: 'addAttachment',
                            productId,
                            taskId: intent.taskId,
                            url: intent.url
                        }
                    }
                }
            }
            case 'EXECUTE_ACTION': {
                const { action, taskId, changes } = intent.payload

                // Consolidation: All task updates go through 'updateTask'
                if (action === 'updateTask' || action === 'updateTaskStatus') {
                    // Support legacy 'updateTaskStatus' payload if any resident in client
                    const finalChanges = changes || { status: intent.payload.status }

                    const result = await tools.updateTaskTool(taskId, finalChanges)

                    if (result.success) {
                        const updates = Object.entries(finalChanges).map(([k, v]) => `${k} -> ${v}`).join(', ')
                        return {
                            id,
                            role: 'system',
                            content: `✅ Task ${taskId} updated: ${updates}`,
                            type: 'text',
                            timestamp
                        }
                    } else {
                        return {
                            id,
                            role: 'system',
                            content: `❌ Failed to update task: ${result.message}`,
                            type: 'error',
                            timestamp
                        }
                    }
                }

                if (action === 'addAttachment') {
                    const { productId, taskId, url } = intent.payload
                    const result = await tools.addAttachmentTool(url, productId, taskId)

                    if (result.success) {
                        return {
                            id,
                            role: 'system',
                            content: `✅ Attachment added successfully via URL.`,
                            type: 'text',
                            timestamp
                        }
                    } else {
                        return {
                            id,
                            role: 'system',
                            content: `❌ Failed to add attachment: ${result.message}`,
                            type: 'error',
                            timestamp
                        }
                    }
                }

                return {
                    id, role: 'system', content: "Unknown action type.", type: 'error', timestamp
                }
            }
            default:
                return {
                    id,
                    role: 'system',
                    content: "I'm not sure what you mean. Try 'find product X', 'open SKU', 'my tasks', or 'sales for SKU'.",
                    type: 'text',
                    timestamp
                }
        }
    } catch (error) {
        console.error("Orchestrator error:", error)
        return {
            id,
            role: 'system',
            content: "An error occurred while processing your request.",
            type: 'error',
            timestamp
        }
    }
}
