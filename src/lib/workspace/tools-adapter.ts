import { Product, Task, Attachment, SalesItem, ProductSummary } from "./types"
import * as realTools from "./tools"

// --- Interface ---
export interface ToolAdapter {
    // Read
    getProductBySku(sku: string): Promise<Product | null>
    searchProducts(query: string): Promise<ProductSummary[]>
    listTasksByProduct(productId: string): Promise<Task[]>
    listAttachmentsByProduct(productId: string): Promise<Attachment[]>
    querySalesBySku(sku: string, dateRange?: { start: Date, end: Date }): Promise<SalesItem[]>

    // Write
    updateTaskStatus(taskId: string, productId: string, status: string): Promise<{ success: boolean; message?: string }>
    updateTask(taskId: string, changes: any): Promise<{ success: boolean; message?: string }>
    addAttachment(url: string, productId: string, taskId?: string, type?: string): Promise<{ success: boolean; message?: string; attachment_id?: string }>

    // Logging
    appendActivityLog(entityType: string, entityId: string, action: string, actorEmail: string, before: any, after: any): Promise<{ success: boolean; message?: string }>
}

// --- Production Implementation ---
export class GoogleSheetsToolAdapter implements ToolAdapter {
    async getProductBySku(sku: string) { return realTools.getProductBySku(sku) }
    async searchProducts(query: string) { return realTools.searchProducts(query) }
    async listTasksByProduct(productId: string) { return realTools.listTasksByProduct(productId) }
    async listAttachmentsByProduct(productId: string) { return realTools.listAttachmentsByProduct(productId) }
    async querySalesBySku(sku: string, range?: { start: Date, end: Date }) { return realTools.querySalesBySku(sku, range) }

    async updateTaskStatus(taskId: string, pid: string, status: string) { return realTools.updateTaskStatusTool(taskId, pid, status) }
    async updateTask(taskId: string, changes: any) { return realTools.updateTaskTool(taskId, changes) }
    async addAttachment(url: string, pid: string, tid?: string, type?: string) { return realTools.addAttachmentTool(url, pid, tid, type) }
    async appendActivityLog(entityType: any, entityId: string, action: any, actorEmail: string, before: any, after: any) {
        return realTools.appendActivityLog(entityType, entityId, action, actorEmail, before, after)
    }
}

// --- Mock Implementation for Tests ---
export class MockToolAdapter implements ToolAdapter {
    private products: Product[] = [
        { product_id: "p1", sku_code: "TEST-SKU-1", product_name: "Test Product 1", category: "Test", status: "Active", launch_month: "2024-01", sales_channel: "Retail", price: "100" }
    ]
    private tasks: Task[] = [
        { product_task_id: "t1", product_id: "p1", task_name: "Test Task 1", status: "Todo", due_date: "2024-01-01", owner_email: "test@example.com" }
    ]
    private sales: SalesItem[] = [
        { order_id: "s1", order_date: "2024-01-01", sku: "TEST-SKU-1", quantity: "10", total_amount: "1000" }
    ]
    public activityLogs: any[] = []

    // Read
    async getProductBySku(sku: string) { return this.products.find(p => p.sku_code === sku) || null }
    async searchProducts(query: string) {
        return this.products
            .filter(p => p.product_name.includes(query) || p.sku_code.includes(query))
            .map(p => ({ sku: p.sku_code, name: p.product_name, status: p.status, launchDate: p.launch_month, price: p.price }))
    }
    async listTasksByProduct(pid: string) { return this.tasks.filter(t => t.product_id === pid) }
    async listAttachmentsByProduct(pid: string) { return [] }
    async querySalesBySku(sku: string, range?: { start: Date, end: Date }) { return this.sales.filter(s => s.sku === sku) }

    // Write
    async updateTaskStatus(tid: string, pid: string, status: string) {
        const task = this.tasks.find(t => t.product_task_id === tid)
        if (task) {
            task.status = status
            return { success: true }
        }
        return { success: false, message: "Task not found" }
    }
    async updateTask(tid: string, changes: any) {
        const task = this.tasks.find(t => t.product_task_id === tid)
        if (task) {
            Object.assign(task, changes)
            return { success: true }
        }
        return { success: false, message: "Task not found" }
    }
    async addAttachment(url: string, pid: string, tid?: string, type?: string) {
        return { success: true, attachment_id: "att-" + Date.now() }
    }
    async appendActivityLog(entityType: any, entityId: string, action: any, actorEmail: string, before: any, after: any) {
        this.activityLogs.push({ entityType, entityId, action, actorEmail, before, after, timestamp: new Date() })
        return { success: true }
    }
}
