import { findAll } from "@/lib/db/adapter"
import { TemplateTasksTable } from "@/components/admin/TemplateTasksTable"
import { requireAdmin } from "@/lib/db/permissions"

export const dynamic = 'force-dynamic'

export default async function AdminTemplatesPage() {
    await requireAdmin()
    const allTasks = await findAll<any>("template_tasks")
    const tasks = allTasks.filter(t => t.template_id === "TMP-GENERAL") // MVP: Only General

    return (
        <div className="container py-10">
            <h1 className="text-3xl font-bold mb-6">Template: General Launch</h1>
            <TemplateTasksTable tasks={tasks} templateId="TMP-GENERAL" />
        </div>
    )
}
