import { NextRequest, NextResponse } from "next/server"
import { chatHandler } from "@/lib/workspace/orchestrator-core"
import { ChatRequest } from "@/lib/workspace/types"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { v4 as uuidv4 } from "uuid"

export async function POST(req: NextRequest) {
    const trace_id = uuidv4()
    let stage = "init"
    let body: ChatRequest | null = null

    try {
        stage = "parse_request"
        body = await req.json() as ChatRequest

        stage = "auth"
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized", trace_id, stage }, { status: 401 })
        }

        stage = "context_injection"
        // Inject user session into context if missing or stale, but preserve existing context like current_sku
        body.context = {
            ...body.context,
            user: {
                email: session.user?.email || "unknown",
                role: session.user?.role || "Viewer"
            }
        }

        stage = "router"
        const rawText = body.last_user_message?.content || "";
        const normalizedText = rawText.trim().toLowerCase().replace(/\s+/g, " ");

        // Helper for matching
        const matches = (keywords: string[]) => keywords.some(kw => normalizedText.includes(kw));

        // SKU Extraction Helper
        const extractSku = (text: string) => {
            const match = text.match(/\b[A-Z]{2,6}\d{4,10}\b|\b[A-Z]{2,6}-\d{2,10}\b/i)
            return match ? match[0].toUpperCase() : null
        }

        const extractedSku = extractSku(rawText) // Use rawText for SKU case sensitivity check (though we uppercase it)

        // 1. Determine Intent
        let intent = "fallback"
        let requiredContext = false

        // Check for direct selection/SKU provision first?
        // If user says "ATB..." or "Select ATB...", we treat it as selection.
        if (extractedSku && (matches(["เลือก", "select", "choose"]) || rawText.length < 20)) {
            intent = "selection_confirmed"
        } else if (rawText.startsWith("EXECUTE_ACTION")) {
            intent = "execute_action"
        } else if (matches(["สวัสดี", "hello", "hi"])) {
            intent = "greeting"
        } else if (matches(["ขอข้อมูลสินค้า", "ข้อมูลสินค้า", "รายละเอียดสินค้า", "product info"])) {
            intent = "product_info"
            requiredContext = true
        } else if (matches(["งานค้าง", "งานที่ต้องทำ", "task", "to do"])) {
            intent = "tasks_summary"
            requiredContext = true
        } else if (matches(["ไฟล์", "เอกสาร", "แนบไฟล์", "attachment"])) {
            intent = "attachments_list"
            requiredContext = true
        } else if (matches(["สรุปสถานะ", "สรุปทั้งหมด", "สรุปรวม"])) {
            intent = "full_summary"
            requiredContext = true
        } else if (matches(["ค้นหา", "search", "find", "หา"])) {
            intent = "search_workspace"
        } else if (matches(["checklist", "เช็คลิสต์", "งานที่ต้องทำ"])) {
            intent = "create_checklist"
        }

        // 2. Resolution Logic
        let resolvedSku = body.context.currentSku
        // If we extracted a SKU from text, it overrides context context temporarily (or permanently if confirmed)
        if (extractedSku) {
            resolvedSku = extractedSku
        }

        let uiEvents = [] as any[]
        let assistantContent = ""
        let debugResolver = {} as any

        // Capture Pending Intent if Context Missing
        // Only if we DON'T have a resolved SKU yet
        if (requiredContext && !resolvedSku) {
            body.context.pending_intent = {
                type: intent,
                original_text: rawText // keep original
            }
        }

        // Search/Resolution 
        // We run search if:
        // 1. No resolved SKU AND intent is NOT greeting.
        // 2. OR intent is selection_confirmed (to validate the SKU exists?) -> actually if we extracted it, we assume valid for now or could validate.
        // 3. BUT if we already have 'extractedSku', we arguably "resolved" it syntactically. We should just validate it exists.

        if (extractedSku) {
            // We have a candidate SKU. Let's assume it's valid for this flow or check existence.
            // For now, accept it. 
            // Always send set_url_sku when we identify a straight SKU
            uiEvents.push({ type: "set_url_sku", payload: { sku: extractedSku } })
            body.context.currentSku = extractedSku
        } else if (!resolvedSku && intent !== "greeting" && intent !== "execute_action") {
            // No SKU found, try fuzzy search
            // Skip search if intent is execute_action
            stage = "resolution"
            const query = rawText

            const { searchProducts } = await import("@/lib/workspace/tools")
            const candidates = await searchProducts(query)

            debugResolver = {
                query,
                candidates_count: candidates.length,
                top_candidates: candidates.slice(0, 3)
            }

            if (candidates.length === 1 && candidates[0].score >= 60) {
                // Auto-resolve
                resolvedSku = candidates[0].sku
                assistantContent = `ค้นพบสินค้า ${candidates[0].productName} (${candidates[0].sku})...`
                uiEvents.push({ type: "set_url_sku", payload: { sku: resolvedSku } })
                body.context.currentSku = resolvedSku
            } else if (candidates.length > 1) {
                // Ambiguous
                intent = "choose_product"
                uiEvents.push({
                    type: "choose_product",
                    payload: {
                        candidates: candidates.map((c: any) => ({
                            sku: c.sku,
                            name: c.productName,
                            status: c.status,
                            score: c.score
                        }))
                    }
                })
                assistantContent = "พบสินค้าหลายรายการ โปรดเลือกสินค้าที่ต้องการครับ:"
            } else {
                // Zero matches
                if (requiredContext && !resolvedSku) {
                    intent = "missing_sku"
                    assistantContent = "ขอโทษครับ ผมไม่แน่ใจว่าหมายถึงสินค้าตัวไหน รบกวนระบุ SKU หรือชื่อสินค้าอีกครั้งครับ"
                    // pending_intent is already set above
                }
            }
        }

        // 3. Execution Logic
        stage = "execution"
        let response

        // Replay Pending Intent Logic
        const pendingIntentBefore = body.context.pending_intent
        let pendingIntentConsumed = false;

        if (resolvedSku && body.context.pending_intent) {
            // We have a SKU now, and a pending intent. Replay it.
            intent = body.context.pending_intent.type
            // Consume: Set to null (JSON safe)
            body.context.pending_intent = undefined // Typescript might want undefined, but JSON output will be missing key.
            // User requested null for JSON.
            // We'll handle the response object mapping to null.
            pendingIntentConsumed = true;
        }

        // For processing, we use internal state. 
        // When building response, we ensure it is explicit.

        // If still blocking (choose or missing), return response
        if (intent === "choose_product" || intent === "missing_sku") {
            response = {
                assistant_message: { role: "assistant", content: assistantContent },
                updated_context: {
                    ...body.context,
                    pending_intent: body.context.pending_intent || null // Explicit null
                },
                ui_events: uiEvents,
                debug_trace: {
                    trace_id,
                    stage,
                    router_decision: intent,
                    resolver: debugResolver,
                    pending_intent_before: pendingIntentBefore,
                    pending_intent_after: body.context.pending_intent || null
                }
            }
            return NextResponse.json(response)
        }

        // 4. Command Execution
        const { getProductBySku } = await import("@/lib/workspace/tools")

        if (intent === "execute_action") {
            const actionJson = rawText.replace("EXECUTE_ACTION", "").trim()
            let executionResult = ""

            try {
                const actionPayload = JSON.parse(actionJson)

                if (actionPayload.type === "launch_product") {
                    const { launchProduct } = await import("@/lib/workspace/tools")
                    const result = await launchProduct(actionPayload.sku)
                    if (result.success) {
                        executionResult = `Launch initiated for ${actionPayload.sku}`
                    } else {
                        executionResult = `Failed to launch ${actionPayload.sku}: ${result.message}`
                    }
                } else if (actionPayload.type === "create_checklist") {
                    const { createTasksBatchTool } = await import("@/lib/workspace/tools")
                    const result = await createTasksBatchTool(actionPayload.productId, actionPayload.tasks)
                    if (result.success) {
                        executionResult = `Created ${result.count} tasks for ${actionPayload.sku}`
                    } else {
                        executionResult = `Failed to create checklist: ${result.message}`
                    }
                } else {
                    executionResult = `Unknown action type: ${actionPayload.type}`
                }
            } catch (e) {
                executionResult = `Failed to execute action: Invalid Payload`
            }

            response = {
                assistant_message: { role: "assistant", content: executionResult },
                updated_context: body.context,
                ui_events: [],
            }

        } else if (intent === "greeting") {
            response = {
                assistant_message: { role: "assistant", content: "สวัสดีครับ 😊 มีอะไรให้ช่วยเกี่ยวกับสินค้าไหมครับ?" },
                updated_context: body.context,
                ui_events: [],
            }
        } else if (intent === "selection_confirmed") {
            response = {
                assistant_message: { role: "assistant", content: `รับทราบครับ เลือกสินค้า ${body.context.currentSku} แล้ว ต้องการดูข้อมูลอะไรเพิ่มเติมไหมครับ?` },
                updated_context: body.context,
                ui_events: [...uiEvents] // pass through set_url_sku
            }
        } else if (intent === "product_info" && resolvedSku) {
            const product = await getProductBySku(resolvedSku)
            response = {
                assistant_message: {
                    role: "assistant",
                    content: product
                        ? `ข้อมูลสินค้า **${product.product_name}** (${product.sku_code}):\nSTATUS: ${product.status}\nPRICE: ${product.price}`
                        : `ไม่พบข้อมูลสำหรับ SKU: ${resolvedSku}`
                },
                updated_context: body.context,
                ui_events: [...uiEvents],
            }
        } else if (intent === "tasks_summary" && resolvedSku) {
            response = {
                assistant_message: { role: "assistant", content: `แสดงรายการงานสำหรับ ${resolvedSku}... (Coming Soon)` },
                updated_context: body.context,
                ui_events: [...uiEvents]
            }
        } else if (intent === "attachments_list" && resolvedSku) {
            response = {
                assistant_message: { role: "assistant", content: `แสดงไฟล์แนบสำหรับ ${resolvedSku}... (Coming Soon)` },
                updated_context: body.context,
                ui_events: [...uiEvents]
            }
        } else if (intent === "full_summary" && resolvedSku) {
            response = {
                assistant_message: { role: "assistant", content: `สรุปสถานะทั้งหมดของ ${resolvedSku}... (Coming Soon)` },
                updated_context: body.context,
                ui_events: [...uiEvents]
            }
        } else if (intent === "search_workspace") {
            const { searchWorkspace } = await import("@/lib/workspace/tools")
            // Use rawText for search to preserve casing if needed, or normalized
            const results = await searchWorkspace(rawText)

            let message = `ผลการค้นหาสำหรับ "${rawText}":\n`
            const newUiEvents = [...uiEvents]

            // 1. Products
            if (results.products.length > 0) {
                message += `\n📦 **สินค้าที่พบ (${results.products.length}):**\n`
                // Add choose_product event
                newUiEvents.push({
                    type: "choose_product",
                    payload: {
                        candidates: results.products.map((p: any) => ({
                            sku: p.sku || p.sku_code,
                            name: p.productName || p.product_name,
                            status: p.status,
                            score: p.score || 100
                        }))
                    }
                })
                // Also list them in text for fallback/history
                results.products.slice(0, 3).forEach((p: any) => {
                    message += `- **${p.productName}** (${p.sku})\n`
                })
            }

            // 2. Tasks
            if (results.tasks.length > 0) {
                message += `\n📋 **งานที่พบ (${results.tasks.length}):**\n`
                results.tasks.slice(0, 5).forEach((t: any) => {
                    message += `- [${t.status}] ${t.task_name} (${t.owner_email})\n`
                })
            }

            if (results.files.length > 0) {
                message += `\n📁 **ไฟล์ที่พบ (${results.files.length}):**\n`
                results.files.slice(0, 5).forEach((f: any) => {
                    message += `- [${f.name}](${f.webViewLink})\n`
                })
            }

            if (results.products.length === 0 && results.tasks.length === 0 && results.files.length === 0) {
                message = `ไม่พบข้อมูลที่ตรงกับ "${rawText}" ในระบบครับ`
            }

            response = {
                assistant_message: { role: "assistant", content: message },
                updated_context: body.context,
                ui_events: newUiEvents
            }
        } else if (intent === "create_checklist" && resolvedSku) {
            const { getChecklistTemplate } = await import("@/lib/workspace/templates")
            const { getProductBySku } = await import("@/lib/workspace/tools")

            // 1. Get Product Details
            const product = await getProductBySku(resolvedSku)
            if (!product) {
                // Should not happen if resolvedSku is valid, but handle safely
                response = {
                    assistant_message: { role: "assistant", content: `ไม่พบข้อมูลสินค้า ${resolvedSku} ในระบบครับ` },
                    updated_context: body.context,
                    ui_events: []
                }
            } else {
                // 2. Get Template (Default launch)
                const template = getChecklistTemplate("launch")
                if (template) {
                    // 3. Generate Tasks Preview
                    const tasksToCreate = template.tasks.map(t => ({
                        task_name: t.task_name,
                        status: "Pending",
                        priority: "Medium",
                        phase: t.phase,
                        owner_email: t.default_owner_role === "Admin" ? "admin@example.com" : "", // Placeholder
                        product_id: product.product_id
                    }))

                    response = {
                        assistant_message: {
                            role: "assistant",
                            content: `เตรียมสร้าง Checklist "${template.name}" สำหรับ ${product.product_name} (${resolvedSku}) จำนวน ${tasksToCreate.length} งานครับ\n\nกดปุ่มด้านล่างเพื่อยืนยันการสร้าง:`
                        },
                        updated_context: body.context,
                        ui_events: [
                            {
                                type: "show_confirmation",
                                payload: {
                                    title: `Create ${template.name}`,
                                    message: `Are you sure you want to create ${tasksToCreate.length} tasks for ${resolvedSku}?`,
                                    action_id: `create_checklist_${resolvedSku}_${Date.now()}`,
                                    data: {
                                        sku: resolvedSku,
                                        productId: product.product_id,
                                        type: "create_checklist",
                                        tasks: tasksToCreate
                                    }
                                }
                            }
                        ]
                    }
                } else {
                    response = {
                        assistant_message: { role: "assistant", content: `ไม่พบ Template สำหรับการสร้าง Checklist ครับ` },
                        updated_context: body.context,
                        ui_events: []
                    }
                }
            }
        } else {
            // Fallback
            response = {
                assistant_message: {
                    role: "assistant",
                    content: assistantContent || "ผมยังไม่เข้าใจคำสั่งนี้ครับ ลองใช้ 'ขอข้อมูลสินค้า [ชื่อสินค้า]'"
                },
                updated_context: body.context,
                ui_events: [...uiEvents],
                debug_trace: {
                    trace_id,
                    stage: "fallback",
                    router_decision: "fallback",
                    context_in: body.context
                }
            }
        }

        // Normalize pending_intent in response
        if (pendingIntentConsumed) {
            response.updated_context.pending_intent = null
        }

        // Attach Debug
        if (process.env.NODE_ENV === "development") {
            const finalDecision = intent;
            response.debug_trace = {
                ...response.debug_trace,
                trace_id,
                stage,
                router_decision: finalDecision,
                normalized_text: normalizedText,
                extracted_sku: extractedSku,
                resolver: debugResolver,
                pending_intent_before: pendingIntentBefore,
                pending_intent_after: pendingIntentConsumed ? null : (body.context.pending_intent || null),
                context_in: body.context
            } as any // Cast to allow extra debug fields
        }

        // Execute Resolver if needed (for PR-3D.1 verification)
        if (response.debug_trace && (intent === "missing_sku" || intent === "fallback")) {
            const query = body.last_user_message?.content || "";
            // Only search if meaningful query
            if (query.length > 2) {
                const { searchProducts } = await import("@/lib/workspace/tools");
                const candidates = await searchProducts(query);

                response.debug_trace = {
                    ...response.debug_trace,
                    resolver_query: query,
                    resolver_candidates_count: candidates.length,
                    resolver_top_candidates: candidates.slice(0, 3)
                } as any
            }
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error(`[Trace: ${trace_id}] Chat API Error at stage ${stage}:`, error)

        return NextResponse.json({
            error: "INTERNAL_ERROR",
            trace_id,
            stage,
            message: process.env.NODE_ENV === "development" ? error.message : "An unexpected error occurred."
        }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    return NextResponse.json(
        { error: "Method Not Allowed", message: "Use POST to chat" },
        { status: 405 }
    )
}
