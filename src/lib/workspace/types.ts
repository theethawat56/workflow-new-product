export interface WorkspaceState {
    currentSku?: string
    currentUserEmail?: string
    currentUserRole?: string

    // Legacy support (to be refactored into SharedContext fully later)
    [key: string]: any
}

// --- B1) ChatMessage ---
export interface AttachmentRef {
    id: string
    filename: string
    mime_type: string
    size_bytes: number
    url?: string
    drive_url?: string
    extracted_text?: string
}

export interface ChatMessage {
    id: string
    role: "user" | "assistant" | "tool" | "system" // system for UI events/errors in legacy
    content: string
    timestamp: string // ISO
    attachments?: AttachmentRef[]
    meta?: Record<string, any>

    // Legacy support
    type?: "text" | "product_card" | "task_list" | "sales_summary" | "confirmation_request" | "error"
    data?: any
    contextUpdates?: Partial<WorkspaceState>
}

// --- B2) SharedContext ---
export interface PendingIntent {
    type: string
    original_text: string
}

export interface SharedContext {
    currentSku?: string
    current_product_id?: string
    date_range?: { start: string; end: string }
    pending_questions?: string[]
    last_intent?: string
    last_tool_results?: Record<string, any>
    user?: { email: string; role: string }
    timezone: string
    pending_intent?: PendingIntent | null
    taskPagination?: {
        page: number
        sku?: string // if scoped
    }
}

// Alias for LLM Agent
export type ChatContext = SharedContext

// --- B3) ChatRequest ---
export interface ChatRequest {
    conversation_id?: string
    messages: ChatMessage[]
    context: SharedContext
    last_user_message: ChatMessage
    client_state?: { selected_panel?: string; locale?: string; debug?: boolean }
}

// --- B4) UIEvent ---
export type UIEventType = "render_context_cards" | "show_confirmation" | "toast" | "show_search_results" | "choose_product" | "set_url_sku" | "choose_task" | "choose_file"

export interface ProposedAction {
    type: "tool_call"
    tool: string
    args: Record<string, any>
}

export interface ConfirmationCard {
    confirmation_id: string
    title: string
    summary: string
    description?: string // Added for legacy compatibility/richer UI
    actions: { label: string; action: "confirm" | "cancel" }[]
    proposed_actions: ProposedAction[]

    // Legacy compatibility fields
    actionType?: string
    payload?: any
}

export interface UIEvent {
    type: UIEventType
    payload: any
}

// --- B5) ChatResponse ---
export interface ChatResponse {
    assistant_message: { role: "assistant"; content: string }
    updated_context: SharedContext
    ui_events: UIEvent[]
    debug_trace?: Record<string, any>

    // Legacy compatibility
    id?: string
    role?: string
    content?: string
    type?: string
    timestamp?: Date
    contextUpdates?: Partial<WorkspaceState>
}

// --- B6/B7) Confirm Request/Response ---
export interface ConfirmRequest {
    conversation_id: string
    confirmation_id: string
    decision: "confirm" | "cancel"
    context: SharedContext
}

export interface ConfirmResponse {
    assistant_message: { role: "assistant"; content: string }
    updated_context: SharedContext
    ui_events: UIEvent[]
}

// --- C) HandoffContract v1 ---
export interface HandoffContract {
    intent: string
    summary: string
    questions_for_user: string[]
    proposed_actions: ProposedAction[]
    data_needed: string[]
    risk_flags: string[]
}

// --- F) OrchestratorPlan ---
export interface OrchestratorPlan {
    intent: string
    agents_to_call: ("ProductIntake" | "LaunchOps" | "SalesInsight" | "DocsAssets" | "QAValidator" | "AdminRBAC")[]
    read_tools_to_call: { tool: string; args: Record<string, any> }[]
    notes: string
}

// --- Data Layer Types (matching Schema) ---
export interface Product {
    product_id: string
    sku_code: string
    product_name: string
    category: string
    status: string
    launch_month: string
    sales_channel: string
    price: string
    [key: string]: any
}

export interface Task {
    product_task_id: string
    product_id: string
    task_name: string
    status: string
    due_date: string
    owner_email: string
    [key: string]: any
}

export interface Attachment {
    attachment_id: string
    product_id: string
    type: string
    drive_url: string
    created_at: string
    [key: string]: any
}

export interface SalesItem {
    order_id: string
    order_date: string
    sku: string
    quantity: string
    total_amount: string
    [key: string]: any
}

export interface ProductSummary {
    sku: string
    name: string
    status: string
    launchDate: string
    price: string
}

// Backwards compatibility
export type Message = Message_Legacy
export type ConfirmationData = ConfirmationData_Legacy

export interface Message_Legacy {
    id: string
    role: "user" | "system" | "assistant"
    content: string
    type: "text" | "product_card" | "task_list" | "sales_summary" | "confirmation_request" | "error"
    data?: any
    timestamp: Date
    contextUpdates?: Partial<WorkspaceState>
}

export interface ConfirmationData_Legacy {
    actionType: string
    summary: string
    description?: string
    payload: any // The actual data needed to execute the action
}
