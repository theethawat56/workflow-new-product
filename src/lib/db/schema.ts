export const SHEETS_CONFIG = {
    users: {
        name: "users",
        headers: ["email", "name", "role", "active"],
    },
    role_defaults: {
        name: "role_defaults",
        headers: ["role", "owner_email", "note"],
    },
    products: {
        name: "products",
        headers: [
            "product_id",
            "sku_code",
            "product_name",
            "category",
            "sub_category",
            "launch_month",
            "go_live_date",
            "sales_channel",
            "cost",
            "price",
            "gp_pct",
            "status",
            "created_at",
            "updated_at",
            "created_by",
        ],
    },
    product_role_assignments: {
        name: "product_role_assignments",
        headers: ["product_id", "role", "owner_email", "note"],
    },
    task_templates: {
        name: "task_templates",
        headers: ["template_id", "template_name", "active"],
    },
    template_tasks: {
        name: "template_tasks",
        headers: [
            "template_id",
            "task_code",
            "task_name",
            "phase",
            "default_owner_role",
            "offset_days",
            "duration_days",
            "depends_on",
            "required_fields",
            "input_type",
        ],
    },
    product_tasks: {
        name: "product_tasks",
        headers: [
            "product_task_id",
            "product_id",
            "task_code",
            "task_name",
            "phase",
            "owner_role",
            "owner_email",
            "start_date",
            "due_date",
            "status",
            "priority",
            "blocker_reason",
            "notes",
            "updated_at",
            "input_type",
        ],
    },
    attachments: {
        name: "attachments",
        headers: [
            "attachment_id",
            "product_id",
            "product_task_id",
            "type",
            "drive_url",
            "created_at",
            "created_by",
        ],
    },
    activity_log: {
        name: "activity_log",
        headers: [
            "log_id",
            "entity_type",
            "entity_id",
            "action",
            "before_json",
            "after_json",
            "actor_email",
            "timestamp",
        ],
    },
} as const

export type SheetName = keyof typeof SHEETS_CONFIG

export type UserRole =
    | "Admin"
    | "PM"
    | "Ops"
    | "Ecom"
    | "Marketing"
    | "CS"
    | "AfterService"
    | "Finance"

export const USER_ROLES: UserRole[] = [
    "Admin",
    "PM",
    "Ops",
    "Ecom",
    "Marketing",
    "CS",
    "AfterService",
    "Finance",
]

export type TaskPhase =
    | "Order Sample Testing"
    | "Import Checking"
    | "Ordering"
    | "Product Artwork"
    | "Shipment"
    | "Take Sample for KOL"
    | "Quality and Claim"
    | "Content KOL"
    | "Marketing Content"
    | "Product Detail"
    | "Launch" // Keeping generic launch for safety
    | "AfterSales" // Keeping generic aftersales for safety

export type TaskStatus =
    | "NotStarted"
    | "InProgress"
    | "Blocked"
    | "QA"
    | "Review"
    | "Approved"
    | "Done"

export type ProductStatus = "Draft" | "Active" | "Hold" | "Launched"
