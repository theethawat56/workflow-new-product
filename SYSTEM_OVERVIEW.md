# System Overview: Chat-First Product Workflow

## 1. High-Level Architecture

The system implements a **Chat-First** workflow where users interact with a natural language interface to query product data, manage tasks, and access files. The core orchestration logic resides in the Next.js API route (`/api/workspace/chat`), which handles intent recognition, context management, and tool execution.

### Flow A: Ask Protocol (Missing Context -> Pending Intent -> Replay)

User asks for info without specifying a product. System captures intent, asks for clarification, and replays intent once SKU is provided.

```mermaid
sequenceDiagram
    participant User
    participant UI as ChatInterface
    participant API as ChatRoute
    participant Tool as Tools(Search/Get)

    User->>UI: "ขอข้อมูลสินค้า" (No Context)
    UI->>API: POST /chat (content: "ขอข้อมูลสินค้า", context: {})
    API->>API: Router: "product_info" matches
    API->>API: Check Context: currentSku is missing
    API->>API: Set pending_intent = { type: "product_info" }
    API-->>UI: Response (Msg: "Which SKU?", pending_intent saved)
    
    User->>UI: "SKU123"
    UI->>API: POST /chat (content: "SKU123", context: { pending_intent })
    API->>Tool: searchProducts("SKU123")
    Tool-->>API: [Candidate(SKU123, Score 100)]
    API->>API: Resolution: Single Match -> resolvedSku = SKU123
    API->>API: Check pending_intent ("product_info")
    API->>API: Replay Intent: Execute "product_info" with SKU123
    API->>Tool: getProductBySku("SKU123")
    Tool-->>API: Product Data
    API-->>UI: Response (Msg: "Info for SKU123...", ui_event: set_url_sku)
    UI->>UI: Update URL (?sku=SKU123)
```

### Flow B: Ambiguity Protocol (Ambiguous -> Choose UI -> Set Context -> Replay)

User query matches multiple products. System presents choice buttons.

```mermaid
sequenceDiagram
    participant User
    participant UI as ChatInterface
    participant API as ChatRoute

    User->>UI: "product"
    UI->>API: POST /chat (content: "product")
    API->>API: Tool: searchProducts("product") -> [A, B, C]
    API-->>UI: Response (Msg: "Choose...", ui_event: choose_product[A,B,C])
    UI->>UI: Render Product Cards
    
    User->>UI: Click Card B
    UI->>UI: Update URL (?sku=B)
    UI->>API: POST /chat (content: "เลือก B", context: { currentSku: B })
    API->>API: Router: "selection_confirmed"
    API-->>UI: Response (Msg: "Acknowledged B")
```

### Flow C: Direct Protocol (SKU in URL -> Immediate Execution)

User already has context (e.g., from URL).

```mermaid
sequenceDiagram
    participant User
    participant UI as ChatInterface
    participant API as ChatRoute

    User->>UI: "งานค้าง" (URL: ?sku=SKU123)
    UI->>API: POST /chat (content: "งานค้าง", context: { currentSku: "SKU123" })
    API->>API: Router: "tasks_summary"
    API->>API: Check Context: currentSku exists
    API->>API: Execute "tasks_summary" for SKU123
    API-->>UI: Response (Msg: "Tasks for SKU123...")
```

## 2. Components & Responsibilities

| Component | File Path | Responsibility |
|-----------|-----------|----------------|
| **Chat Interface** | `src/components/workspace/ChatInterface.tsx` | - Capture user input<br>- Manage URL state (`?sku=`)<br>- Render UI events (`choose_product`)<br>- Construct API payload |
| **API Router** | `src/app/api/workspace/chat/route.ts` | - **Authentication**: Verify NextAuth session<br>- **Context Injection**: Merge user/session data<br>- **Router**: Regex-based intent matching<br>- **Resolution**: Handle missing SKU / ambiguity<br>- **Replay**: Execute pending intents |
| **Tools** | `src/lib/workspace/tools.ts` | - `searchProducts(query)`: Fuzzy search & scoring<br>- `getProductBySku(sku)`: Fetch details<br>- `getTasks(sku)`: Fetch tasks |
| **Orchestrator** | `src/lib/workspace/orchestrator-core.ts` | - (Legacy/Advanced) Multi-step agent planning (currently bypassed for direct commands) |
| **Google Sheets** | `src/lib/google/sheets.ts` | - Data persistence layer (Products, Tasks, Activity Log) |

## 3. Data Sources

The system relies on a Google Sheet as the primary database (acting as a CMS/ERP).

| Feature | Sheet Name | Description |
|---------|------------|-------------|
| **Product Resolution** | `products` | Columns: `sku_code`, `product_name`, `status`, `brand`, `price` |
| **Task Management** | `tasks` | Columns: `product_id`, `task_name`, `status`, `due_date` |
| **Attachments** | `attachments` | (Planned) Links to Drive files |
| **Sales Data** | `sales` | (Planned) Transaction records |

---
**Note**: All sensitive keys (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, etc.) are managed via environment variables and are **not** exposed in the client bundle.
