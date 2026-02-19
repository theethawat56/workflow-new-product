# Implementation Plan - Multi-Agent Test Suite

We will establish a robust 3-layer testing strategy (Unit, Contract, E2E) for the Multi-Agent Backend.

## User Review Required
> [!IMPORTANT]
> This plan requires installing `jest` and `ts-jest`.
> Use `npm test` to run all tests.

## Proposed Changes

### 1. Infrastructure (New Dependencies)
- `npm install -D jest ts-jest @types/jest ts-node`
- Create `jest.config.ts`

### 2. Refactoring for Testability
To allow mocking tools (Google Sheets) without hitting real APIs during tests, we will implement the **Adapter Pattern**.

#### [NEW] [tools-adapter.ts](file:///Users/t.punhongwiset/Documents/Autobot/WorkFlow_New_Product/src/lib/workspace/tools-adapter.ts)
- Define `ToolAdapter` interface (all read/write methods).
- Implement `GoogleSheetsToolAdapter` (Production implementation wrapping `tools.ts`).
- Implement `MockToolAdapter` (Test implementation with canned data).

#### [MODIFY] [orchestrator-core.ts](file:///Users/t.punhongwiset/Documents/Autobot/WorkFlow_New_Product/src/lib/workspace/orchestrator-core.ts)
- Update `chatHandler` and `confirmHandler` to accept an optional `ToolAdapter`.
- Default to `GoogleSheetsToolAdapter` if not provided (Preserve existing behavior).

### 3. Test Layers

#### Unit Tests (`tests/unit`)
- **auth-checks.test.ts**: Validate RBAC logic (Admin vs Viewer).
- **tool-adapter.test.ts**: Ensure MockAdapter returns expected structure.

#### Contract Tests (`tests/contract`)
- **schemas.test.ts**: Validate `HandoffContract` and `OrchestratorPlan` schemas against valid/invalid JSON examples.
- Does not call LLM, but validates strict schema conformance.

#### E2E Tests (`tests/e2e`)
- **chat-flow.test.ts**:
    - Simulate `POST /api/workspace/chat`.
    - Use `MockToolAdapter`.
    - Mock OpenAI responses (Stubbed).
    - Scenarios:
        1. **Read**: User asks for SKU -> Orchestrator Plan -> Tool Call -> Helper Agent -> Final Response.
        2. **Write**: User asks to update task -> Confirmation Card returned.
        3. **Confirm**: User confirms -> `confirmHandler` called -> Mutation executed on MockAdapter.

## Verification Plan
### Automated Tests
- Run `npm test` to execute the entire suite.
- Run `npm run test:unit`, `npm run test:contract`, `npm run test:e2e` individually.
