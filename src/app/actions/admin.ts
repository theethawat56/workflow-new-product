"use server"

import { initializeDatabase } from "@/lib/db/init"

export async function initializeDatabaseAction() {
    try {
        const result = await initializeDatabase()
        return result
    } catch (error: any) {
        return { success: false, message: error.message }
    }
}
