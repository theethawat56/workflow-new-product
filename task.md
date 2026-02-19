# Task Checklist: Confirmation UX (MVP2 M2-S3)

- [ ] Research ChatInterface tool handling <!-- id: 0 -->
- [x] Create Implementation Plan <!-- id: 1 -->
- [x] Create Confirmation Card Component <!-- id: 2 -->
- [x] Implement Tool Interception Logic in ChatInterface <!-- id: 3 -->
- [x] Verify Confirmation Flow <!-- id: 4 -->

# Task Checklist: Task Mutations (MVP2 M2-S4)
- [ ] Research existing task mutation capabilities <!-- id: 5 -->
- [x] Create Implementation Plan for M2-S4 <!-- id: 6 -->
- [x] Update `updateTaskAction` to support all fields (due date, notes, blocker, assignee) <!-- id: 7 -->
- [x] Update `tools.ts` to expose mutation tools <!-- id: 8 -->
- [x] Update `orchestrator.ts` to handle new mutation intents <!-- id: 9 -->
- [x] Verify Task Mutations via Chat <!-- id: 10 -->

# Task Checklist: Attachment Creation (MVP2 M2-S5)
- [ ] Research existing attachment actions <!-- id: 11 -->
- [x] Create Implementation Plan for M2-S5 <!-- id: 12 -->
- [x] Update `tools.ts` to expose `addAttachmentTool` <!-- id: 13 -->
- [x] Update `orchestrator.ts` to handle URL/Attachment intents <!-- id: 14 -->
- [x] Verify Attachment Creation via Chat <!-- id: 15 -->
- [x] Verify Attachment Creation via Chat <!-- id: 15 -->

# Task Checklist: Context Panel & Search (MVP1 M1-S6)
- [x] Research ContextPanel and SearchOverlay state <!-- id: 16 -->
- [x] Create Implementation Plan for M1-S6 <!-- id: 17 -->
- [x] Implement/Update `SearchOverlay` <!-- id: 18 -->
- [x] Wire `ContextPanel` to real data hooks/actions <!-- id: 19 -->
- [x] Integrate Search and Context update in `ChatInterface` <!-- id: 20 -->
- [x] Verify Context Switching <!-- id: 21 -->

# Task Checklist: Multi-Agent Backend (MVP2 M2-S6)
- [x] Create Implementation Plan for Multi-Agent Backend <!-- id: 22 -->
- [x] Update `types.ts` with new Schemas <!-- id: 23 -->
- [x] Update `tools.ts` (MVP1 Read + MVP2 Write + Logger) <!-- id: 24 -->
- [x] Create Agent Registry and Prompts (`src/lib/workspace/agents/`) <!-- id: 25 -->
- [x] Implement Orchestrator Loop (`orchestrator-core.ts`) <!-- id: 26 -->
- [x] Create API Endpoints (`/api/workspace/chat`, `/confirm`) <!-- id: 27 -->
- [x] Verify End-to-End Flow <!-- id: 28 -->

# Task Checklist: Test Suite (MVP2 M2-S7)
- [x] Install Jest/Vitest dependencies <!-- id: 29 -->
- [x] Create `jest.config.ts` <!-- id: 30 -->
- [x] Implement `ToolAdapter` Pattern (`src/lib/workspace/tools-adapter.ts`) <!-- id: 31 -->
- [x] Refactor `orchestrator-core.ts` to use `ToolAdapter` <!-- id: 32 -->
- [x] Write Unit Tests (`tests/unit`) <!-- id: 33 -->
- [x] Write Contract Tests (`tests/contract`) <!-- id: 34 -->
- [x] Write E2E Tests (`tests/e2e`) <!-- id: 35 -->
- [x] Verify All Tests Pass <!-- id: 36 -->

# Task Checklist: Refactor Chat API (PR-1)
- [ ] Create Implementation Plan <!-- id: 37 -->
- [ ] Verify/Update `api/workspace/chat/route.ts` <!-- id: 38 -->
- [x] Refactor `ChatInterface.tsx` to use `fetch` <!-- id: 39 -->
- [x] Verify Chat Flow with new API <!-- id: 40 -->

# Task Checklist: Debug Trace & Error Handling (PR-2)
- [x] Implement `debug_trace` in `api/workspace/chat/route.ts` <!-- id: 41 -->
- [x] Update `ChatInterface.tsx` to handle `trace_id` errors <!-- id: 42 -->
- [x] Verify Error Handling <!-- id: 43 -->

# Task Checklist: Minimal Command Router (PR-3A)
- [x] Implement greeting/fallback router in `api/workspace/chat/route.ts` <!-- id: 44 -->
- [x] Verify Router Responses <!-- id: 45 -->

# Task Checklist: SKU Context Propagation (PR-3B)
- [x] Update `ChatInterface.tsx` to send `currentSku` <!-- id: 46 -->
- [x] Update `route.ts` to handle SKU context and validation <!-- id: 47 -->
- [x] Verify SKU propagation in debug trace <!-- id: 48 -->

# Task Checklist: SKU URL Persistence (PR-3B.URL)
- [x] Update `ChatInterface.tsx` to sync SKU with URL <!-- id: 49 -->
- [x] Verify URL updates on SKU selection <!-- id: 50 -->
- [x] Verify Chat Payload includes URL SKU <!-- id: 51 -->

# Task Checklist: Product Search Resolver (PR-3D.1)
- [x] Implement `searchProducts` logic with scoring <!-- id: 52 -->
- [x] Integrate into tool layer <!-- id: 53 -->
- [x] Add debug trace for resolver <!-- id: 54 -->

# Task Checklist: Chat-First Resolution (PR-3D.2)
- [ ] Update `types.ts` for Trace and Events <!-- id: 55 -->
- [ ] Implement Resolution Logic (0, 1, Multi matches) in `route.ts` <!-- id: 56 -->
- [ ] Connect Command Execution (Product, Tasks, Attachments) <!-- id: 57 -->
- [ ] Verify Resolution Flow <!-- id: 58 -->
