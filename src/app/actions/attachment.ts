"use server"

import { create } from "@/lib/db/adapter"
import { v4 as uuidv4 } from "uuid"
import { revalidatePath } from "next/cache"
import { uploadFileToDrive } from "@/lib/google/drive"

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

export async function uploadAttachmentAction(productId: string, type: string, formData: FormData) {
    try {
        const file = formData.get("file") as File
        if (!file) throw new Error("No file uploaded")

        const buffer = Buffer.from(await file.arrayBuffer())
        const uploadedFile = await uploadFileToDrive(buffer, file.name, file.type)

        if (!uploadedFile || !uploadedFile.webViewLink) {
            throw new Error("Failed to upload to Drive")
        }

        await create("attachments", {
            attachment_id: uuidv4(),
            product_id: productId,
            product_task_id: "",
            type,
            drive_url: uploadedFile.webViewLink,
            created_at: new Date().toISOString(),
            created_by: "system"
        })

        revalidatePath(`/products/${productId}`)
        return { success: true }
    } catch (error: any) {
        console.error("Upload error:", error)
        return { success: false, message: error.message }
    }
}
