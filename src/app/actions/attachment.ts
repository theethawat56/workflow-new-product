"use server"

import { create, findOne } from "@/lib/db/adapter"
import { v4 as uuidv4 } from "uuid"
import { revalidatePath } from "next/cache"
import { uploadFileToDrive } from "@/lib/google/drive"
import { createAttachmentSchema } from "@/lib/validations/attachment"
import { logActivity } from "@/lib/logger"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"

export async function addAttachmentAction(productId: string, taskId: string, url: string, type: string) {
    try {
        const session = await getServerSession(authOptions)
        const actor = session?.user?.email || "system"

        // 1. Validation
        const validatedFields = createAttachmentSchema.safeParse({ productId, taskId, url, type })
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

        const attachmentId = uuidv4()
        const attachmentData = {
            attachment_id: attachmentId,
            product_id: validatedData.productId,
            product_task_id: validatedData.taskId || "",
            type: validatedData.type,
            drive_url: validatedData.url,
            created_at: new Date().toISOString(),
            created_by: actor
        }

        await create("attachments", attachmentData)

        await logActivity("attachment", attachmentId, "create", actor, null, attachmentData)

        revalidatePath(`/products/${productId}`)
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function uploadAttachmentAction(productId: string, type: string, formData: FormData) {
    try {
        const session = await getServerSession(authOptions)
        const actor = session?.user?.email || "system"

        const file = formData.get("file") as File
        if (!file) throw new Error("No file uploaded")

        const buffer = Buffer.from(await file.arrayBuffer())
        const uploadedFile = await uploadFileToDrive(buffer, file.name, file.type)

        if (!uploadedFile || !uploadedFile.id) {
            throw new Error("Failed to upload to Drive")
        }

        const baseUrl = process.env.NEXTAUTH_URL || "https://work-flow-new-product.vercel.app"
        const driveUrl = `${baseUrl}/api/image?fileId=${uploadedFile.id}`

        // Integrity Check
        const product = await findOne<any>("products", "product_id", productId)
        if (!product) {
            throw new Error(`Integrity Error: Product ${productId} does not exist.`)
        }

        const attachmentId = uuidv4()
        const attachmentData = {
            attachment_id: attachmentId,
            product_id: productId,
            product_task_id: "",
            type,
            drive_url: driveUrl,
            created_at: new Date().toISOString(),
            created_by: actor
        }

        await create("attachments", attachmentData)

        await logActivity("attachment", attachmentId, "create", actor, null, attachmentData)

        revalidatePath(`/products/${productId}`)
        return { success: true }
    } catch (error: any) {
        console.error("Upload error:", error)
        return { success: false, message: error.message }
    }
}
