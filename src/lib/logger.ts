import { create } from "@/lib/db/adapter"
import { v4 as uuidv4 } from "uuid"

export type ActivityAction = "create" | "update" | "delete"
export type ActivityEntityType = "product" | "product_task" | "attachment" | "user" | "sys_task_template"

export async function logActivity(
    entityType: ActivityEntityType,
    entityId: string,
    action: ActivityAction,
    actorEmail: string,
    before: any = null,
    after: any = null
) {
    try {
        console.log(`[ACTIVITY] ${action.toUpperCase()} ${entityType} ${entityId} by ${actorEmail}`)
        await create("activity_log", {
            log_id: uuidv4(),
            entity_type: entityType,
            entity_id: entityId,
            action: action,
            before_json: before ? JSON.stringify(before) : "",
            after_json: after ? JSON.stringify(after) : "",
            actor_email: actorEmail,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error("Failed to log activity:", error)
        // Don't throw, logging failure shouldn't block the actual operation
    }
}
