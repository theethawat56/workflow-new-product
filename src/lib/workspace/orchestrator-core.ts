import {
    ChatRequest,
    ChatResponse,
    ConfirmRequest,
    ConfirmResponse,
    SharedContext,
    UIEvent,
    ConfirmationCard,
    ProposedAction
} from "./types"
import { AGENT_PROMPTS, AgentName } from "./agents/registry"
import { ToolAdapter, GoogleSheetsToolAdapter } from "./tools-adapter"
import { validateAction } from "./auth-checks"
import OpenAI from "openai"

// Default Adapter
const defaultAdapter = new GoogleSheetsToolAdapter()

// Initialize OpenAI (Server-side only)
const apiKey = process.env.OPENAI_API_KEY
console.log("[Orchestrator] Initializing OpenAI with Key:", apiKey ? "Present (Starts with " + apiKey.substring(0, 3) + ")" : "MISSING")

const openai = new OpenAI({
    apiKey: apiKey || "dummy-key-for-build", // safe fallback for build
})

// --- Helper: Call LLM with Standard JSON Output ---
async function callAgent(agentName: AgentName, messages: any[]) {
    const systemPrompt = AGENT_PROMPTS[agentName]

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-2024-08-06",
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ],
            response_format: { type: "json_object" }
        })

        const content = completion.choices[0].message.content
        if (!content) return null
        return JSON.parse(content)
    } catch (error) {
        console.error(`Error calling agent ${agentName}:`, error)
        return null
    }
}

// --- 1. CHAT HANDLER ---
export async function chatHandler(request: ChatRequest, adapter: ToolAdapter = defaultAdapter): Promise<ChatResponse> {
    const { messages, context, last_user_message } = request
    const uiEvents: UIEvent[] = []

    // A. PLAN: Orchestrator decides intent and delegation
    const planPrompt = `
    Analyze the user message and current context.
    Decide which read tools to call and which specialist agents to consult.
    Context: ${JSON.stringify(context)}
    User Message: ${last_user_message.content}
    
    Output JSON Plan only:
    {
        "intent": "string",
        "agents_to_call": ["ProductIntake" | "LaunchOps" | "SalesInsight" | "DocsAssets" | "QAValidator" | "AdminRBAC"],
        "read_tools_to_call": [{ "tool": "string", "args": {} }],
        "notes": "string"
    }
    `

    let plan: any = null
    try {
        const planCompletion = await openai.chat.completions.create({
            model: "gpt-4o-2024-08-06",
            messages: [
                { role: "system", content: AGENT_PROMPTS.Orchestrator },
                { role: "user", content: planPrompt }
            ],
            response_format: { type: "json_object" }
        })

        const planContent = planCompletion.choices[0].message.content
        plan = planContent ? JSON.parse(planContent) : null
    } catch (e: any) {
        console.error("Planning failed with error:", e)
        plan = { error: String(e), message: e.message }
    }

    // B. READ: Execute Tools
    const toolResults: Record<string, any> = {}
    if (plan && plan.read_tools_to_call) {
        for (const call of plan.read_tools_to_call) {
            try {
                // Dynamic dispatch to adapter (safely)
                const toolFn = (adapter as any)[call.tool]
                if (typeof toolFn === 'function') {
                    const result = await toolFn.call(adapter, ...Object.values(call.args))
                    toolResults[call.tool] = result
                }
            } catch (e) {
                console.error(`Tool execution failed: ${call.tool}`, e)
                toolResults[call.tool] = { error: String(e) }
            }
        }
    }

    // C. AGENTS: Fan-out to specialists
    const agentOutputs: Record<string, any> = {}
    if (plan && plan.agents_to_call) {
        await Promise.all(plan.agents_to_call.map(async (agentName: string) => {
            if (agentName === 'Orchestrator') return // Skip self

            const agentMessages = [
                { role: "user", content: `Context: ${JSON.stringify(context)}` },
                { role: "user", content: `Tool Results: ${JSON.stringify(toolResults)}` },
                { role: "user", content: `User Message: ${last_user_message.content}` }
            ]

            const result = await callAgent(agentName as AgentName, agentMessages)
            agentOutputs[agentName] = result
        }))
    }

    // D. SYNTHESIS: Final Response
    const synthesisPrompt = `
    User Message: ${last_user_message.content}
    Plan: ${JSON.stringify(plan)}
    Tool Results: ${JSON.stringify(toolResults)}
    Agent Outputs: ${JSON.stringify(agentOutputs)}
    
    Synthesize these into a helpful response in Thai.
    If there are proposed actions, summarize them but DO NOT execute.
    If questions needed, ask them.
    `

    let finalContent = "ขออภัย ไม่สามารถประมวลผลได้"
    try {
        const finalCompletion = await openai.chat.completions.create({
            model: "gpt-4o-2024-08-06",
            messages: [
                { role: "system", content: AGENT_PROMPTS.Orchestrator },
                { role: "user", content: synthesisPrompt }
            ]
        })
        finalContent = finalCompletion.choices[0].message.content || finalContent
    } catch (e) {
        console.error("Synthesis failed:", e)
    }

    // E. EVENTS: Generate UI Events (Cards, Confirmations)
    // Check if any agent proposed actions
    let confirmationCard: ConfirmationCard | undefined
    const allProposedActions: ProposedAction[] = []

    Object.values(agentOutputs).forEach((out: any) => {
        if (out?.proposed_actions) {
            allProposedActions.push(...out.proposed_actions)
        }
    })

    if (allProposedActions.length > 0) {
        confirmationCard = {
            confirmation_id: Date.now().toString(),
            title: "ยืนยันการดำเนินการ",
            summary: "โปรดยืนยันรายการต่อไปนี้",
            description: allProposedActions.map(a => `${a.tool}: ${JSON.stringify(a.args)}`).join('\n'),
            actions: [
                { label: "ยืนยัน", action: "confirm" },
                { label: "ยกเลิก", action: "cancel" }
            ],
            proposed_actions: allProposedActions
        }
        uiEvents.push({ type: "show_confirmation", payload: confirmationCard })
    }

    return {
        assistant_message: { role: "assistant", content: finalContent },
        updated_context: { ...context, last_tool_results: toolResults },
        ui_events: uiEvents
    }
}

// --- 2. CONFIRM HANDLER ---
export async function confirmHandler(request: ConfirmRequest, adapter: ToolAdapter = defaultAdapter): Promise<ConfirmResponse> {
    const { decision, context, confirmation_id } = request

    if (decision === 'cancel') {
        return {
            assistant_message: { role: "assistant", content: "ยกเลิกรายการแล้วครับ" },
            updated_context: context,
            ui_events: []
        }
    }

    // Execute Actions (Mock for now)
    await adapter.appendActivityLog("user", context.user?.email || "unknown", "update", context.user?.email || "unknown", null, { decision, confirmation_id })

    return {
        assistant_message: { role: "assistant", content: "ดำเนินการเรียบร้อยครับ (Simulation)" },
        updated_context: context,
        ui_events: [{ type: "toast", payload: { level: "info", message: "Success" } }]
    }
}
