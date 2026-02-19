# State Model: Context & Persistence

## 1. SharedContext Interface

The system maintains a `SharedContext` object that persists across turns via the client-side state machine.

```typescript
export interface SharedContext {
    // Current Active Product (CamelCase)
    currentSku?: string;

    // Pending Replay Packet
    pending_intent?: {
        type: string;        // Intent ID (e.g., "product_info")
        original_text: string; // User's original query
    } | null;

    // User Identity (Injected by Server)
    user: {
        email: string;
        role: "Viewer" | "Editor" | "Admin";
    };

    // Session Data
    timezone: string;
    last_intent?: string;
    pending_questions?: string[];
}
```

## 2. Persistence Strategy

### Primary Source of Truth: URL
- The SKU is persisted in the URL query parameter: `?sku=...`.
- Client `window.location.search` is read on **every submit** to ensure freshness.
- This allows deep-linking and browser navigation (Back/Forward).

### Transient State: Client Memory
- `pending_intent`: Stored in `context` object in `workspaceState` (React State).
- Cleared on page refresh (by design, to avoid stale intents).

### Sync Policy
- **Server -> Client**:
  - Response `updated_context` merges into client state.
  - If `updated_context.currentSku` changes, Client updates URL.
- **Client -> Server**:
  - Request `context` is built from URL + Client Memory.

## 3. Pending Intent Lifecycle

| Step | State Change | Trigger |
|------|--------------|---------|
| **1. Set** | `pending_intent = { type, text }` | Router detects valid intent but `currentSku` is missing. |
| **2. Persist** | Client stores in Memory | Server returns updated context; Client saves it. |
| **3. Provide SKU** | User inputs SKU / Click | Client sends `sku` + `pending_intent`. |
| **4. Consume** | `pending_intent = null` | Server resolves SKU -> Executes stored intent -> Clears field. |

## 4. Failure Modes

- **Invalid SKU**: If user provides invalid SKU, `pending_intent` is preserved (retry allowed) or cleared based on implementing logic (currently preserved).
- **Intent Mismatch**: If user switches topic (e.g., "Actually, show tasks"), new intent overrides pending intent.
