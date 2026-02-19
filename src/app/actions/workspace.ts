"use server"

import { Message, WorkspaceState, ChatRequest } from "@/lib/workspace/types"
import { chatHandler } from "@/lib/workspace/orchestrator-core"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import * as tools from "@/lib/workspace/tools"

export async function processMessage(message: string, clientContext: WorkspaceState): Promise<Message> {
    const session = await getServerSession(authOptions)

    // Adapter: WorkspaceState -> SharedContext
    const request: ChatRequest = {
        conversation_id: "legacy-" + Date.now(),
        messages: [],
        context: {
            currentSku: clientContext.currentSku,
            user: {
                email: session?.user?.email || "unknown",
                role: session?.user?.role || "Viewer"
            },
            timezone: "Asia/Bangkok" // Default
        },
        last_user_message: {
            id: Date.now().toString(),
            role: "user",
            content: message,
            timestamp: new Date().toISOString()
        }
    }

    // Call Multi-Agent Backend
    const response = await chatHandler(request)

    // Adapter: ChatResponse -> Message (Legacy)
    const legacyMessage: Message = {
        id: Date.now().toString(),
        role: "system", // Legacy UI expects system/assistant, system often used for structured
        content: response.assistant_message.content,
        type: "text",
        timestamp: new Date(),
        contextUpdates: {
            currentSku: response.updated_context.currentSku
        }
    }

    // Handle UI Events
    response.ui_events.forEach(event => {
        if (event.type === "show_confirmation") {
            legacyMessage.type = "confirmation_request"
            legacyMessage.data = event.payload
        }
        else if (event.type === "show_search_results") {
            // If we had this, mapping would go here
        }
    })

    return legacyMessage
}

export async function getWorkspaceContextData(sku: string) {
    const product = await tools.getProductBySku(sku)
    if (!product) return null

    const [tasks, attachments, sales] = await Promise.all([
        tools.listTasksByProduct(product.product_id),
        tools.listAttachmentsByProduct(product.product_id),
        tools.querySalesBySku(sku, {
            start: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
            end: new Date()
        })
    ])

    return {
        product,
        tasks,
        attachments,
        sales
    }
}

export async function searchProductsAction(query: string) {
    return await tools.searchProducts(query)
}
