# System Report: Workspace Chat (Chat-First Workflow)

## 1. User Flows

### Happy Path (Context First)
1. **User**: "ขอข้อมูลสินค้า ATB123" (Direct SKU)
2. **System**: 
   - Extracts "ATB123" -> Updates URL to `?sku=ATB123`.
   - Resolves SKU against Product Database.
   - Responds: "ข้อมูลสินค้า Product A (ATB123)..." with price/status.

### Happy Path (Ask -> Select)
1. **User**: "ขอข้อมูลสินค้า" (No SKU)
2. **System**: "ต้องการดูข้อมูลของ SKU ไหนครับ?" (Sets `pending_intent: product_info`)
3. **User**: "ATB123" (or clicks product card matching "ATB")
4. **System**:
   - Resolves "ATB123".
   - Finds `pending_intent`.
   - Replays "product_info" for "ATB123".
   - Responds: "ข้อมูลสินค้า Product A..."

### Failure Path (Ambiguous)
1. **User**: "Samsung"
2. **System**: Finds 2+ matches. Responds with "Choose Product" UI (cards).
3. **User**: Selects wrong one / types chaos.
4. **System**: Updates context to selection OR asks for clarification again.

## 2. API Contract Summary (`POST /api/workspace/chat`)

**Request**:
```json
{
  "last_user_message": { "role": "user", "content": "..." },
  "context": {
    "currentSku": "ATB...",      // CamelCase
    "pending_intent": { "type": "...", "original_text": "..." } // Optional
  }
}
```

**Response**:
```json
{
  "assistant_message": { "role": "assistant", "content": "..." }, // Markdown
  "updated_context": { 
    "currentSku": "...", 
    "pending_intent": null // Explicitly null to clear
  },
  "ui_events": [ 
    { "type": "set_url_sku", "payload": { "sku": "..." } },
    { "type": "choose_product", "payload": { "candidates": [...] } }
  ]
}
```

## 3. State Model

- **Source of Truth**: URL Query Param (`?sku=...`).
- **Client State**: `workspaceState` mirrors URL. Syncs strictly (URL changes -> State updates).
- **Pending Intent**:
  - **Set**: When intent rules match but `currentSku` is missing (`requiredContext = true`).
  - **Persist**: Stored in client `workspaceState` (via API response).
  - **Consume**: When `currentSku` becomes available (via resolution/selection), intent is executed and field set to `null`.

## 4. SKU Resolution Logic

Ordered by priority:
1.  **Regex Extraction**: `/\b[A-Z]{2,6}\d{4,10}\b|\b[A-Z]{2,6}-\d{2,10}\b/i`
    -   If found in text, overrides everything.
2.  **Context**: If `currentSku` exists in request, use it.
3.  **Fuzzy Search**: If neither above, run `searchProducts(query)`.
    -   1 Strong Match (>60 score) -> Auto-resolve.
    -   Multiple Matches -> Trigger `choose_product`.
    -   No Matches -> Fallback/Ask user.

## 5. Data Sources

| Domain | Status | Source |
|--------|--------|--------|
| **Authentication** | ✅ Implemented | `next-auth` (Google) |
| **Products** | ✅ Implemented | Google Sheets (`products` tab) |
| **Tasks** | ⚠ Partial | Google Sheets (`tasks` tab) - Logic stubbed in places |
| **Attachments** | ❌ Stubbed | Hardcoded response "Coming Soon" |
| **Sales** | ❌ Stubbed | Hardcoded response "Coming Soon" |

## 6. Known Issues & Fixes

1.  **"Connected" Role**: Initial socket/rail message might incorrectly use `system` role (Visual inconsistencies). **Fix**: Enforce `assistant` role globally.
2.  **Task Mutation**: "Add task" intent exists but write-back to Sheets is not fully wired in Chat API (only in Actions). **Fix**: Wire `createTask` tool.
3.  **Attachment Upload**: UI supports it, but backend handler is missing. **Fix**: Implement `uploadFile` tool.

## 7. Minimal Test Checklist

- [ ] **Direct SKU**: Type `ATB123` -> Verify URL updates & Info appears.
- [ ] **Ask -> SKU**: Type "Product Info" -> System asks -> Type `ATB123` -> Info appears.
- [ ] **Ambiguous**: Type "CommonName" -> Verify Product Cards -> Click one -> Info appears.
- [ ] **Persistence**: Refresh page with `?sku=ATB123` -> Type "Tasks" -> See tasks for ATB123.
- [ ] **Clear Context**: Click "New Chat" -> URL clears -> Context clears.
