# Test Evidence: Chat-First Workflow

## 1. Flow A: Ask Protocol (Missing Context -> Pending Intent -> Replay)

**User Input**: "ขอข้อมูลสินค้า"
**Context In**: `{}` (Empty)

**Response**:
```json
{
    "assistant_message": { "content": "ต้องการดูข้อมูลของ SKU ไหนครับ? รบกวนระบุ SKU หรือเลือกจากรายการด้านซ้ายได้เลยครับ" },
    "updated_context": { 
        "pending_intent": { "type": "product_info", "original_text": "ขอข้อมูลสินค้า" }
    }
}
```

**User Input 2**: "SKU-001"
**Context In**: `{ pending_intent: { type: "product_info", ... } }`

**Response**:
```json
{
    "assistant_message": { "content": "ข้อมูลสินค้า **Product A** (SKU-001):\nSTATUS: Launched..." },
    "updated_context": { "currentSku": "SKU-001", "pending_intent": undefined },
    "ui_events": [{ "type": "set_url_sku", "payload": { "sku": "SKU-001" } }]
}
```

## 2. Flow B: Ambiguity Protocol (Ambiguous -> Choose -> Replay)

**User Input**: "product" (Matches Product A, Product B)
**Context In**: `{}`

**Response**:
```json
{
    "assistant_message": { "content": "พบสินค้าหลายรายการ โปรดเลือกสินค้าที่ต้องการครับ:" },
    "ui_events": [{ 
        "type": "choose_product", 
        "payload": { "candidates": [{"sku": "SKU-001", ...}, {"sku": "SKU-002", ...}] } 
    }]
}
```

**User Action**: Click "Product B" (SKU-002)
**Network Request**: `POST` (content: "เลือก SKU-002", context: {currentSku: "SKU-002"})

**Response**:
```json
{
    "assistant_message": { "content": "รับทราบครับ เลือกสินค้า SKU-002 แล้ว ต้องการดูข้อมูลอะไรเพิ่มเติมไหมครับ?" },
    "updated_context": { "currentSku": "SKU-002" }
}
```

## 3. Flow C: Direct Protocol (Context Exists -> Exec)

**User Input**: "งานค้าง"
**Context In**: `{ currentSku: "SKU-003" }` (From URL)

**Response**:
```json
{
    "assistant_message": { "content": "แสดงรายการงานสำหรับ SKU-003... (Coming Soon)" },
    "updated_context": { "currentSku": "SKU-003" }
}
```

## Definition of Done Checklist

- [x] Client passes `currentSku` from URL on every request.
- [x] Server identifies Intent even without SKU.
- [x] Server sets `pending_intent` if logic requires context.
- [x] Server consumes `pending_intent` upon resolution.
- [x] Client renders `choose_product` events.
- [x] Client updates URL on `set_url_sku` event.

## 4. Automated Integration Tests (Jest)
**Date:** 2026-02-12
**Scope:** Chat API Flows (Pending Intent, SKU Resolution, Ambiguous Selection, Checklist Creation)
**Result:** PASS

### Execution Log
```bash
> jest tests/integration/chat-flow.test.ts

 PASS  tests/integration/chat-flow.test.ts
  Chat API Integration Flows
    ✓ Flow 1: Ask -> Pending Intent Set (6 ms)
    ✓ Flow 2: Provide SKU -> Replay Intent -> Pending Intent Cleared (3 ms)
    ✓ Flow 3: Ambiguous Selection -> Choose Product Event (1 ms)
    ✓ Flow 4: Checklist Creation -> Confirmation -> Execution (4 ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        1.234 s
```

### Flow Details
1.  **Pending Intent**: Verified that asking for product info without an SKU sets `pending_intent` in context.
2.  **SKU Resolution**: Verification that providing an SKU clears the `pending_intent` and triggers the original intent (product info) on the new SKU.
3.  **Ambiguous Selection**: Confirmed that ambiguous queries return a `choose_product` UI event.
4.  **Checklist Cycle**: 
    -   Confirms `create_checklist` intent returns a `show_confirmation` event with correct payload.
    -   Confirms `EXECUTE_ACTION` with checklist payload triggers the creation tool and returns success message.

## 5. Manual Test Checklist

- [ ] **Pending Intent**:
    - Ask "Info". Agent asks "Which SKU?". Context shows `pending_intent`.
    - Reply "TEST001". Agent shows info for TEST001. Intent cleared.
- [ ] **Ambiguity**:
    - Ask "Ambiguous". Agent shows list.
    - Click item. URL updates. Agent confirms selection.
- [ ] **Checklist**:
    - Select SKU. Ask "Create checklist".
    - Agent shows preview ("Prepare to create 5 tasks").
    - Click "Confirm". Agent says "Created 5 tasks".
    - Verify tasks appear in "Tasks" tab or sheet.
