import * as z from "zod"

export const createAttachmentSchema = z.object({
    productId: z.string().min(1, "Product ID is required"),
    taskId: z.string().optional(),
    url: z.string().url("Invalid URL"),
    type: z.string().min(1, "Type is required"),
})

export type CreateAttachmentValues = z.infer<typeof createAttachmentSchema>
