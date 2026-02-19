export interface ChecklistTemplate {
    id: string
    name: string
    description: string
    tasks: {
        task_code: string
        task_name: string
        phase: string
        default_owner_role: string
        default_due_offset_days: number
    }[]
}

export const TEMPLATES: Record<string, ChecklistTemplate> = {
    "launch": {
        id: "launch",
        name: "New Product Launch",
        description: "Standard checklist for launching a new product",
        tasks: [
            {
                task_code: "T1",
                task_name: "Upload Spec Sheet",
                phase: "Preparation",
                default_owner_role: "Product Manager",
                default_due_offset_days: 0
            },
            {
                task_code: "T2",
                task_name: "Approve SKU Code",
                phase: "Preparation",
                default_owner_role: "Admin",
                default_due_offset_days: 1
            },
            {
                task_code: "T3",
                task_name: "Create Marketing Assets",
                phase: "Marketing",
                default_owner_role: "Marketing",
                default_due_offset_days: 3
            },
            {
                task_code: "T4",
                task_name: "Set Pricing",
                phase: "Sales",
                default_owner_role: "Sales Manager",
                default_due_offset_days: 2
            },
            {
                task_code: "T5",
                task_name: "Final Launch Approval",
                phase: "Launch",
                default_owner_role: "Admin",
                default_due_offset_days: 5
            }
        ]
    }
}

export function getChecklistTemplate(type: string): ChecklistTemplate | null {
    return TEMPLATES[type.toLowerCase()] || TEMPLATES["launch"]
}
