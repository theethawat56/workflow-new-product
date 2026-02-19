import * as z from "zod"
import { TaskStatus, TaskPhase, USER_ROLES } from "@/lib/db/schema"

export const updateTaskSchema = z.object({
    status: z.enum([
        "NotStarted",
        "InProgress",
        "Blocked",
        "QA",
        "Review",
        "Approved",
        "Done"
    ] as [string, ...string[]]).optional(),
    priority: z.enum(["High", "Medium", "Low"]).optional(),
    blocker_reason: z.string().optional(),
    notes: z.string().optional(),
    owner_role: z.enum(USER_ROLES as [string, ...string[]]).optional(),
    owner_email: z.string().email("Invalid email").optional().or(z.literal("")),
    start_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid start date",
    }).optional().or(z.literal("")),
    due_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid due date",
    }).optional().or(z.literal("")),
})

export type UpdateTaskValues = z.infer<typeof updateTaskSchema>
