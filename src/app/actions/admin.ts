"use server"

import { initializeDatabase } from "@/lib/db/init"
import { findAll } from "@/lib/db/adapter"

export async function initializeDatabaseAction() {
    try {
        const result = await initializeDatabase()
        return result
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function getOrphanTasksReport() {
    try {
        const products = await findAll<any>("products")
        const productTasks = await findAll<any>("product_tasks")

        const productIds = new Set(products.map((p) => p.product_id))
        const orphanTasks = productTasks.filter((t) => !productIds.has(t.product_id))

        const uniqueMissingProductIds = Array.from(new Set(orphanTasks.map((t) => t.product_id)))

        return {
            totalOrphanTasks: orphanTasks.length,
            uniqueMissingProductIdsCount: uniqueMissingProductIds.length,
            uniqueMissingProductIds,
            success: true
        }
    } catch (error: any) {
        console.error("Error getting orphan tasks report:", error)
        return { success: false, message: error.message }
    }
}
