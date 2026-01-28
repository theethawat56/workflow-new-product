"use server"

import { create } from "@/lib/db/adapter"
import { v4 as uuidv4 } from "uuid"
import { revalidatePath } from "next/cache"

export async function addAttachmentAction(productId: string, taskId: string, url: string, type: string) {
    try {
        await create("attachments", {
            attachment_id: uuidv4(),
            product_id: productId,
            product_task_id: taskId || "", // Optional link to task
            type,
            drive_url: url,
            created_at: new Date().toISOString(),
            created_by: "system"
        })
        revalidatePath(`/products/${productId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
