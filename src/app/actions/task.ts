"use server"

import { update, findOne } from "@/lib/db/adapter"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { updateTaskSchema } from "@/lib/validations/task"
import { logActivity } from "@/lib/logger"

export async function updateTaskAction(taskId: string, productId: string, data: any) {
    try {
        const session = await getServerSession(authOptions)
        const actor = session?.user?.email || "system"

        // 1. Validation
        const validatedFields = updateTaskSchema.safeParse(data)
        if (!validatedFields.success) {
            return {
                success: false,
                message: "Validation Error: " + validatedFields.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ")
            }
        }
        const validatedData = validatedFields.data

        // 2. Integrity Check: Product must exist
        const product = await findOne<any>("products", "product_id", productId)
        if (!product) {
            return { success: false, message: `Integrity Error: Product ${productId} does not exist.` }
        }

        // Get Before state
        const before = await findOne<any>("product_tasks", "product_task_id", taskId)

        // Update
        await update("product_tasks", "product_task_id", taskId, {
            ...validatedData,
            updated_at: new Date().toISOString()
        })

        // Log Activity
        if (before) {
            await logActivity("product_task", taskId, "update", actor, before, { ...before, ...validatedData })
        }

        revalidatePath(`/products/${productId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
