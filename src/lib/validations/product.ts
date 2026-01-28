import * as z from "zod"
import { USER_ROLES } from "@/lib/db/schema"

export const productSchema = z.object({
    sku_code: z.string().min(1, "SKU Code is required"),
    product_name: z.string().min(1, "Product Name is required"),
    category: z.string().min(1, "Category is required"),
    sub_category: z.string().optional(),
    launch_month: z.enum([
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ], {
        required_error: "Launch Month is required",
    }),
    go_live_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date",
    }),
    sales_channel: z.array(z.string()).min(1, "Select at least one Sales Channel"),
    cost: z.coerce.number().min(0, "Cost must be >= 0"),
    price: z.coerce.number().min(0, "Price must be >= 0"),
    activate: z.boolean().default(false),
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
