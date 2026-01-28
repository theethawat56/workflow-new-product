"use server"

import { create, update, findOne } from "@/lib/db/adapter"
import { revalidatePath } from "next/cache"

export async function createUserAction(data: any) {
    try {
        const existing = await findOne("users", "email", data.email)
        if (existing) throw new Error("User already exists")

        await create("users", {
            email: data.email,
            name: data.name,
            role: data.role,
            active: true
        })
        revalidatePath("/admin/users")
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function updateUserAction(email: string, data: any) {
    try {
        await update("users", "email", email, data)
        revalidatePath("/admin/users")
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

export async function registerUserAction(data: any) {
    try {
        // Double check if user exists
        const existing = await findOne("users", "email", data.email)
        if (existing) return { success: true, message: "User already exists" }

        await create("users", {
            email: data.email,
            name: data.name,
            role: data.role,
            active: true
        })
        revalidatePath("/admin/users")
        return { success: true }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
