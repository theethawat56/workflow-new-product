"use server"

import { create } from "@/lib/db/adapter"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { v4 as uuidv4 } from "uuid"

// Simple validation for MVP
interface TaskInput {
    product_id: string
    task_name: string
    status: string
    priority: string
    phase?: string
    owner_email?: string
    due_date?: string
}

export async function createTasksBatchAction(productId: string, tasks: TaskInput[]) {
    try {
        const session = await getServerSession(authOptions)
        // Security: Only allow if not just a generic viewer/anonymous
        if (!session?.user) {
            return { success: false, message: "Unauthorized" }
        }

        // RBAC: Enforce Editor/Admin only
        const userRole = session.user.role || "Viewer"
        if (userRole === "Viewer") {
            return { success: false, message: "Permission Denied: Viewers cannot create checklists." }
        }

        // 1. Fetch ProductUtils to get SKU (we need SKU for the sheet)
        // We use fetchSheet to get the product details
        const { fetchSheet } = await import("@/lib/workspace/data-source")
        const allProducts = await fetchSheet<any>("products")
        const product = allProducts.find((p: any) => p.product_id === productId)

        if (!product) {
            return { success: false, message: `Product ${productId} not found` }
        }
        const sku = product.sku_code || product.sku

        const results = []
        for (const task of tasks) {
            const { product_id, ...taskData } = task
            const newTask = {
                product_task_id: uuidv4(),
                product_id: productId,
                sku: sku, // Required column
                task_title: taskData.task_name, // Map task_name to task_title
                status: taskData.status || "Pending",
                assignee: taskData.owner_email || "", // Map owner_email to assignee
                priority: taskData.priority || "Medium",
                due_date: taskData.due_date || "",
                created_at: new Date().toISOString(),
                // Keep original fields just in case? Or strict mapping?
                // User asked for specific columns: sku, task_title, status, assignee, due_date, priority, created_at
                // We'll stick to those + IDs
            }

            // We might need to handle 'updated_at' if the schema requires it, but let's stick to user reqs + basics
            // (Actually the DB adapter might require it, let's keep it safe)
            // @ts-ignore
            newTask.updated_at = new Date().toISOString()

            await create("product_tasks", newTask)
            results.push(newTask.product_task_id)
        }

        revalidatePath(`/products/${productId}`)
        return { success: true, count: results.length, ids: results }

    } catch (error: any) {
        console.error("Batch Create Error:", error)
        return { success: false, message: error.message }
    }
}
