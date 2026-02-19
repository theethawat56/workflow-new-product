# API Contract: Workspace Chat

**Endpoint**: `POST /api/workspace/chat`
**Content-Type**: `application/json`

## 1. Request Schema

```typescript
interface ChatRequest {
    // Unique ID for the conversation (persisted on client)
    // Optional - server largely ignores it but client may send
    conversation_id?: string;
    
    // The latest user message
    last_user_message: {
        role: "user";
        content: string; // Trimmed
    };

    // Shared Context (State)
    context: {
        // CamelCase property for SKU (CRITICAL)
        currentSku?: string; 
        
        // Pending Intent (for Replay Flow)
        pending_intent?: {
            type: string;
            original_text: string;
        } | null;

        // User Identity:
        // Client should NOT send this. Server injects it from Session.
        // user?: { ... } -> Removed from required contract
    };
}
```

## 2. Response Schema

```typescript
interface ChatResponse {
    // The message to display in the chat bubble
    assistant_message: {
        role: "assistant";
        content: string; // Markdown supported
    };

    // Context updates to be merged by Client
    updated_context: {
        currentSku?: string;
        pending_intent?: { type: string; original_text: string } | null; // null = cleared
    };

    // Events to trigger UI actions
    ui_events: UIEvent[];

    // Debugging trace (Dev Mode Only)
    debug_trace?: {
        trace_id: string;
        stage: string;
        router_decision: string;
        resolver?: {
            query: string;
            candidates_count: number;
        };
        pending_intent_before?: any;
        pending_intent_after?: any;
    };
}
```

## 3. UI Events

The client must handle these event types arrayed in `ui_events`.

### A. `choose_product`
Triggered when ambiguity is detected.

```typescript
{
    type: "choose_product",
    payload: {
        candidates: [
            { 
                sku: "SKU-001", 
                name: "Product A", 
                status: "Launched", 
                score: 100 
            },
            // ...
        ]
    }
}
```

**Client Behavior**: Render `product_card` message. On click -> update URL -> send "เลือก [SKU]".

### B. `set_url_sku`
Triggered when server auto-resolves a product (single strong match) or confirms a selection.

```typescript
{
    type: "set_url_sku",
    payload: {
        sku: "SKU-001"
    }
}
```

**Client Behavior**: Update `window.location.search` to `?sku=SKU-001`.

## 4. Naming Standards

- **SKU Field**: Must be `currentSku` (CamelCase) in `context` object.
- **Intent Names**: `product_info`, `tasks_summary`, `attachments_list`, `selection_confirmed`, `greeting`.
