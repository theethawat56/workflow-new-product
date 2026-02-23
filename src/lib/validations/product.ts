import * as z from "zod"
import { USER_ROLES } from "@/lib/db/schema"

export const productSchema = z.object({
    sku_code: z.string().optional().default(""),
    product_name: z.string().optional().default(""),
    category: z.string().optional().default(""),
    sub_category: z.string().optional().default(""),
    launch_month: z.enum([
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ]).optional(),
    go_live_date: z.string().optional().default(""),
    sales_channel: z.array(z.string()).optional().default([]),
    cost: z.coerce.number().min(0).optional().default(0),
    price: z.coerce.number().min(0).optional().default(0),
    fair_detail: z.string().optional().default(""),
    date_of_fair: z.string().optional().default(""),
    product_image_url: z.string().optional().default(""),
    contact_image_url: z.string().optional().default(""),
    activate: z.boolean().optional().default(false),
})

export const roleAssignmentSchema = z.object({
    assignments: z.array(
        z.object({
            role: z.enum(USER_ROLES as [string, ...string[]]),
            owner_email: z.string().email("Invalid email").optional().or(z.literal("")),
            note: z.string().optional(),
        })
    ),
})

export type ProductFormValues = z.infer<typeof productSchema>
export type RoleAssignmentValues = z.infer<typeof roleAssignmentSchema>
