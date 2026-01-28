"use server"

import { update, create, findOne } from "@/lib/db/adapter"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"
import { v4 as uuidv4 } from "uuid"

export async function updateTaskAction(taskId: string, productId: string, data: any) {
    try {
        const session = await getServerSession(authOptions)
        const actor = session?.user?.email || "system"

        // Get Before state
        const before = await findOne<any>("product_tasks", "product_task_id", taskId)

        // Update
        await update("product_tasks", "product_task_id", taskId, {
            ...data,
            updated_at: new Date().toISOString()
        })

        // Log Activity
        if (before) {
            await create("activity_log", {
                log_id: uuidv4(),
                entity_type: "product_task",
                entity_id: taskId,
                action: "update",
                before_json: JSON.stringify(before),
                after_json: JSON.stringify({ ...before, ...data }),
                actor_email: actor,
                timestamp: new Date().toISOString()
            })
        }

        revalidatePath(`/products/${productId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
