import { GoogleGenerativeAI } from "@google/generative-ai"
import { GEMINI_TOOLS_SCHEMA, search_db, resolve_product, get_product_summary, list_pending_tasks } from "./llm-tools"
import { ChatResponse, ChatContext } from "./types"

const apiKey = process.env.GEMINI_API_KEY || ""
console.log("DEBUG: GEMINI_API_KEY present:", !!apiKey, "Length:", apiKey.length)
const genAI = new GoogleGenerativeAI(apiKey)

const SYSTEM_INSTRUCTION = `
You are LaunchFlow assistant. Speak Thai.
- Never invent data; always use tools to read from Sheets/DB.
- If intent requires SKU but missing, call resolve_product or search_db.
- If multiple products match, emit choose_product ui_event via the final response text (see instructions below) OR return text asking user to clarify, but PREFER tool-based resolution first.
- If the user asks for "summarize" or "info", use get_product_summary.
- If the user asks for "tasks" or "jobs" for a SPECIFIC product, use list_pending_tasks with the SKU.
- If the user asks for "all tasks", "my tasks", or "work" without specifying a product, use list_pending_tasks WITHOUT a SKU.

You must return a final answer in Thai.
If you need to trigger a UI Event, include a strictly formatted JSON block in your final text response like this:
\`\`\`json
{ "type": "choose_product", "payload": { ... } }
\`\`\`
Or
\`\`\`json
{ "type": "set_url_sku", "payload": { "sku": "..." } }
\`\`\`
`

const PRIMARY_MODEL = "gemini-2.5-flash-lite"
const FALLBACK_MODEL = "gemini-flash-latest"

async function createChatSession(modelName: string, history: any[]) {
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: GEMINI_TOOLS_SCHEMA as any }]
    })
    return model.startChat({ history })
}

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function callGeminiWithRetry(
    chatSession: any,
    message: string,
    modelName: string,
    retries = 2
): Promise<any> {
    for (let i = 0; i <= retries; i++) {
        try {
            return await chatSession.sendMessage(message)
        } catch (error: any) {
            const isRetryable = error.message?.includes("503") || error.message?.includes("429") || error.message?.includes("404")

            if (isRetryable && i < retries) {
                const waitTime = 1000 * Math.pow(2, i) // 1s, 2s, 4s
                console.warn(`[${modelName}] Error ${error.message}. Retrying in ${waitTime}ms...`)
                await delay(waitTime)
                continue
            }
            throw error
        }
    }
}

export async function runLlmAgent(
    userMessage: string,
    context: ChatContext,
    messageHistory: any[] = []
): Promise<ChatResponse> {
    const history = messageHistory.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
    }))

    const userContextStr = `User Context: Active SKU: ${context.currentSku || "None"}. User Role: ${context.user?.role || "Viewer"}.
            
User Message: ${userMessage}`

    let chat;
    let currentModelName = PRIMARY_MODEL;
    let result;
    let trace: any[] = []
    let uiEvents: any[] = []
    let updatedContext = { ...context }

    // 1. Initialize Chat
    try {
        try {
            chat = await createChatSession(PRIMARY_MODEL, history)
        } catch (e) {
            console.warn(`Failed to init ${PRIMARY_MODEL}, switching to ${FALLBACK_MODEL}`)
            currentModelName = FALLBACK_MODEL
            chat = await createChatSession(FALLBACK_MODEL, history)
        }

        // 2. Send Message (with Retry & Failover)
        try {
            result = await callGeminiWithRetry(chat, userContextStr, currentModelName)
        } catch (e: any) {
            // Check if we can failover (if we haven't already switched)
            if (currentModelName === PRIMARY_MODEL) {
                console.warn(`${PRIMARY_MODEL} failed exhausted retries. Switching to ${FALLBACK_MODEL}`)
                currentModelName = FALLBACK_MODEL

                // Re-init chat with fallback
                chat = await createChatSession(FALLBACK_MODEL, history)
                // Retry with fallback
                result = await callGeminiWithRetry(chat, userContextStr, FALLBACK_MODEL)
            } else {
                throw e
            }
        }

        let response = result.response
        let functionCalls = response.functionCalls()

        const maxIterations = 5
        let iterations = 0

        while (functionCalls && functionCalls.length > 0 && iterations < maxIterations) {
            iterations++
            const toolParts = []

            for (const call of functionCalls) {
                const fnName = call.name
                const args = call.args
                let output: any = { error: "Unknown tool" }

                trace.push({ type: "tool_execution", name: fnName, args })

                try {
                    if (fnName === "search_db") output = await search_db(args as any)
                    else if (fnName === "resolve_product") {
                        output = await resolve_product(args as any)
                        if (output.status === "single" && output.product?.sku) {
                            updatedContext.currentSku = output.product.sku
                            uiEvents.push({ type: "set_url_sku", payload: { sku: output.product.sku } })
                        }
                    }
                    else if (fnName === "get_product_summary") output = await get_product_summary(args as any)
                    else if (fnName === "list_pending_tasks") output = await list_pending_tasks(args as any)
                } catch (toolError) {
                    console.error(`Tool execution error (${fnName}):`, toolError)
                    output = { error: String(toolError) }
                }

                toolParts.push({
                    functionResponse: {
                        name: fnName,
                        response: output
                    }
                })
            }

            // Send tool outputs back (using same retry logic)
            // Note: If model switched during first turn, 'chat' is already the fallback one
            // HOWEVER, createChatSession returns a specific chat instance linked to a model.
            // If we switched models, 'chat' variable holds the new session.
            result = await callGeminiWithRetry(chat, toolParts as any, currentModelName)
            response = result.response
            functionCalls = response.functionCalls()
        }

        // Final Text Response
        let content = response.text()

        // Parse embedded UI Events
        const jsonBlockMatch = content.match(/```json\n([\s\S]*?)\n```/)
        if (jsonBlockMatch) {
            try {
                const event = JSON.parse(jsonBlockMatch[1])
                // Validate event structure lightly
                if (event.type) {
                    uiEvents.push(event)
                }
                // Remove the JSON block from display text
                content = content.replace(jsonBlockMatch[0], "").trim()
            } catch (e) {
                console.error("Failed to parse UI event JSON", e)
            }
        }

        return {
            assistant_message: { role: "assistant", content },
            updated_context: updatedContext,
            ui_events: uiEvents,
            debug_trace: {
                trace_id: `gemini-${Date.now()}`,
                stage: "llm_complete",
                model: currentModelName,
                steps: trace
            }
        }

    } catch (e: any) {
        console.error("Gemini Agent Error:", e)
        const errorMsg = e.message?.includes("503")
            ? "ระบบกำลังทำงานหนัก กรุณารอสักครู่แล้วลองใหม่ (System Overloaded)"
            : `System Error (${currentModelName}): ${e.message}`

        return {
            assistant_message: { role: "assistant", content: errorMsg },
            updated_context: context,
            ui_events: [],
            debug_trace: { error: e.message }
        }
    }
}
