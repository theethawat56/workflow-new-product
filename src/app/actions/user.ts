"use server"

import { create, update, findOne, findAll } from "@/lib/db/adapter"
import { revalidatePath } from "next/cache"
import { hash } from "bcryptjs"

export async function getUsersAction() {
    try {
        const users = await findAll<any>("users")
        // Filter out sensitive data if needed, though for admin internal tool email/name is fine
        return { success: true, data: users }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}

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
        const existing = await findOne<any>("users", "email", data.email)

        const hashedPassword = await hash(data.password, 10)

        // Hardcoded Admin Logic
        let role = ""
        let active = false

        if (data.email === "theethawat56@gmail.com") {
            role = "Admin"
            active = true
        } else {
            // Others are pending
            role = "No Role"
            active = false
        }

        if (existing) {
            // Allow fixing legacy users with no password
            if (!existing.password) {
                await update("users", "email", data.email, {
                    password: hashedPassword,
                    // If admin, enforce admin status. Else keep existing.
                    role: (data.email === "theethawat56@gmail.com") ? "Admin" : existing.role,
                    active: (data.email === "theethawat56@gmail.com") ? true : existing.active
                })
                return { success: true, message: "Legacy account updated with password. You can login now." }
            }

            return { success: false, message: "User already exists" }
        }

        await create("users", {
            email: data.email,
            name: data.name,
            role: role,
            active: active,
            password: hashedPassword
        })

        // No revalidate needed really as redirects happen or admin sees it later
        revalidatePath("/admin/users")

        if (active) {
            return { success: true, message: "Account created successfully." }
        } else {
            return { success: true, message: "Account created. Please wait for admin approval." }
        }
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
