"use server"

import { create, createMany, findAll, findOne, update, deleteRow } from "@/lib/db/adapter"
import { ProductFormValues, RoleAssignmentValues } from "@/lib/validations/product"
import { v4 as uuidv4 } from "uuid"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/google/auth"

export async function createProductAction(productData: ProductFormValues, roleData: RoleAssignmentValues) {
    try {
        const productId = `PRD-${uuidv4().substring(0, 8).toUpperCase()}`
        const now = new Date().toISOString()

        // 1. Create Product
        const gpPct = productData.price > 0
            ? ((productData.price - productData.cost) / productData.price) * 100
            : 0

        // Join sales channels
        const salesChannelStr = Array.isArray(productData.sales_channel)
            ? productData.sales_channel.join(", ")
            : productData.sales_channel

        // Create dependent promises for Parallel Execution
        const createProductPromise = create("products", {
            product_id: productId,
            sku_code: productData.sku_code,
            product_name: productData.product_name,
            category: productData.category,
            sub_category: productData.sub_category || "",
            launch_month: productData.launch_month,
            go_live_date: productData.go_live_date,
            sales_channel: salesChannelStr,
            cost: productData.cost,
            price: productData.price,
            gp_pct: gpPct,
            status: productData.activate ? "Active" : "Draft",
            created_at: now,
            updated_at: now,
            created_by: "system",
        })

        const roleAssignments = roleData.assignments
            .filter(a => a.owner_email)
            .map(assignment => ({
                product_id: productId,
                role: assignment.role,
                owner_email: assignment.owner_email,
                note: assignment.note || "",
            }))

        const createRolesPromise = roleAssignments.length > 0
            ? createMany("product_role_assignments", roleAssignments)
            : Promise.resolve()

        const fetchTemplatesPromise = productData.activate
            ? findAll<any>("template_tasks")
            : Promise.resolve([])

        // EXECUTE PARALLEL
        const [_, __, templateTasks] = await Promise.all([
            createProductPromise,
            createRolesPromise,
            fetchTemplatesPromise
        ])

        console.log("DEBUG: Template Tasks Fetched:", Array.isArray(templateTasks) ? templateTasks.length : "Not Array")

        // 3. Generate Tasks if Activated (using fetched templates)
        if (productData.activate && Array.isArray(templateTasks)) {
            const generalTasks = templateTasks.filter(t => t.template_id === "TMP-GENERAL")
            console.log("DEBUG: General Tasks to Create:", generalTasks.length)
            const newTasks: any[] = []

            for (const tTask of generalTasks) {
                const offset = Number(tTask.offset_days)
                const duration = Number(tTask.duration_days)
                const goLive = new Date(productData.go_live_date)

                const startDate = new Date(goLive)
                startDate.setDate(goLive.getDate() + offset)

                const dueDate = new Date(startDate)
                dueDate.setDate(startDate.getDate() + duration)

                const assignment = roleData.assignments.find(a => a.role === tTask.default_owner_role)
                let ownerEmail = assignment?.owner_email

                newTasks.push({
                    product_task_id: `PT-${uuidv4().substring(0, 8)}`,
                    product_id: productId,
                    task_code: tTask.task_code,
                    task_name: tTask.task_name,
                    phase: tTask.phase,
                    owner_role: tTask.default_owner_role,
                    owner_email: ownerEmail || "",
                    start_date: startDate.toISOString().split('T')[0],
                    due_date: dueDate.toISOString().split('T')[0],
                    status: "NotStarted",
                    priority: "P1",
                    blocker_reason: "",
                    notes: "",
                    updated_at: now,
                    input_type: tTask.input_type || "standard"
                })
            }

            console.log("DEBUG: New Tasks Count:", newTasks.length)
            if (newTasks.length > 0) {
                await createMany("product_tasks", newTasks)
                console.log("DEBUG: createMany executed")
            }
        }

        revalidatePath("/products")
        return { success: true, productId } // Return productId for client redirect
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function updateProductAction(productId: string, data: Partial<ProductFormValues>) {
    try {
        const user = await getServerSession(authOptions)
        const actorEmail = user?.user?.email || "system"
        const now = new Date().toISOString()

        // 1. Get current product to check for date changes
        const currentProduct = await findOne<any>("products", "product_id", productId)
        if (!currentProduct) throw new Error("Product not found")

        const oldGoLive = currentProduct.go_live_date
        const newGoLive = data.go_live_date
        const dateChanged = newGoLive && oldGoLive !== newGoLive

        // 2. Update Product
        const gpPct = (data.price !== undefined && data.cost !== undefined && data.price > 0)
            ? ((data.price - data.cost) / data.price) * 100
            : ((currentProduct.price - currentProduct.cost) / currentProduct.price) * 100 // Fallback or strict calc? data usually complete except activate

        // Join sales channels
        const salesChannelStr = Array.isArray(data.sales_channel)
            ? data.sales_channel.join(", ")
            : data.sales_channel

        const updateData: any = {
            sku_code: data.sku_code,
            product_name: data.product_name,
            category: data.category,
            sub_category: data.sub_category || "",
            launch_month: data.launch_month,
            go_live_date: data.go_live_date,
            sales_channel: salesChannelStr,
            cost: data.cost,
            price: data.price,
            gp_pct: gpPct,
            updated_at: now
        }

        // Only update status if activate is explicitly passed
        if (data.activate !== undefined) {
            updateData.status = data.activate ? "Active" : "Draft"
        }

        await update("products", "product_id", productId, updateData)

        // 3. Recalculate Tasks if Date Changed
        if (dateChanged && (data.activate || currentProduct.status === "Active" || currentProduct.status === "Launched")) {
            // Calculate difference in milliseconds
            const oldDate = new Date(oldGoLive)
            const newDate = new Date(newGoLive!)
            const diffTime = newDate.getTime() - oldDate.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            if (diffDays !== 0) {
                // Fetch all tasks for this product
                const allTasks = await findAll<any>("product_tasks")
                const productTasks = allTasks.filter(t => t.product_id === productId)

                for (const task of productTasks) {
                    const oldStart = new Date(task.start_date)
                    const oldDue = new Date(task.due_date)

                    const newStart = new Date(oldStart)
                    newStart.setDate(newStart.getDate() + diffDays)

                    const newDue = new Date(oldDue)
                    newDue.setDate(newDue.getDate() + diffDays)

                    await update("product_tasks", "product_task_id", task.product_task_id, {
                        start_date: newStart.toISOString().split('T')[0],
                        due_date: newDue.toISOString().split('T')[0],
                        updated_at: now
                    })
                }
            }
        }

        await update("products", "product_id", productId, updateData)

        // 3. Recalculate Tasks if Date Changed
        if (dateChanged && data.activate) {
            // Calculate difference in milliseconds
            const oldDate = new Date(oldGoLive)
            const newDate = new Date(newGoLive)
            const diffTime = newDate.getTime() - oldDate.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            if (diffDays !== 0) {
                // Fetch all tasks for this product
                const allTasks = await findAll<any>("product_tasks")
                const productTasks = allTasks.filter(t => t.product_id === productId)

                for (const task of productTasks) {
                    const oldStart = new Date(task.start_date)
                    const oldDue = new Date(task.due_date)

                    const newStart = new Date(oldStart)
                    newStart.setDate(newStart.getDate() + diffDays)

                    const newDue = new Date(oldDue)
                    newDue.setDate(newDue.getDate() + diffDays)

                    await update("product_tasks", "product_task_id", task.product_task_id, {
                        start_date: newStart.toISOString().split('T')[0],
                        due_date: newDue.toISOString().split('T')[0],
                        updated_at: now
                    })
                }
            }
        }

        revalidatePath(`/products/${productId}`)
        return { success: true }
    } catch (error: any) {
        console.error("Update error:", error)
        return { success: false, message: error.message }
    }
}

export async function deleteProductAction(productId: string) {
    try {
        await deleteRow("products", "product_id", productId)
        // Note: Related records (roles, tasks) remain for now.

        revalidatePath("/products")
        return { success: true }
    } catch (error: any) {
        console.error("Delete error:", error)
        return { success: false, message: error.message }
    }
}

export async function updateProductStatusAction(productId: string, status: string) {
    try {
        await update("products", "product_id", productId, {
            status,
            updated_at: new Date().toISOString()
        })
        revalidatePath("/products")
        return { success: true }
    } catch (error: any) {
        console.error("Update status error:", error)
        return { success: false, message: error.message }
    }
}
