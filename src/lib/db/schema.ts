export const SHEETS_CONFIG = {
    users: {
        name: "users",
        headers: ["email", "name", "role", "active", "password"],
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
            "fair_detail",
            "date_of_fair",
            "product_image_url",
            "contact_image_url",
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
    sale_order_items: {
        name: "sale_order_items",
        headers: [
            "order_id",
            "order_number",
            "order_date",
            "sales_channel",
            "sku",
            "product_name",
            "market_place_name",
            "quantity",
            "price_per_unit",
            "total_amount",
            "customer_name",
            "status",
            "payment_status",
        ],
    },
    launched_products: {
        name: "launched_products",
        headers: [
            "zort_sku",
            "launch_date",
            "product_name",
            "status", // Active, Inactive
            "launch_type" // NEW_LAUNCH, EXISTING_ADDITION
        ]
    },
    target_plan: {
        name: "target_plan",
        headers: [
            "sku",
            "launch_month_plan",
            "expected_units_m1",
            "expected_units_m2",
            "expected_gp_m1",
            "invest_total",
            "price_plan",
            "gp_per_unit_plan"
        ]
    },
    kol: {
        name: "KOL",
        headers: [
            "PIC",
            "Post Date",
            "D", "M", "Y",
            "Count unique",
            "KOL Name",
            "Product Name",
            "SKU",
            "Channel",
            "Budget type",
            "Budget amount",
            "Budget product",
            "Budget Final",
            "KOL Type",
            "Asset Link (drive)",
            "Code",
            "Link",
            "Follower",
            "Viewed",
            "Saved",
            "Liked",
            "Shared",
            "Status",
            "View >1m",
            "taskNumber"
        ]
    },
    sales_all: {
        name: "Sale_All",
        headers: [
            "Date",
            "SKU",
            "Product Name",
            "Units Sold",
            "Revenue",
            "Avg Selling Price"
        ]
    }
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

export type ProductStatus = "Draft" | "Active" | "Hold" | "Launched" | "Existing"
