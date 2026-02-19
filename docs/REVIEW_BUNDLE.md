# Review Bundle: Chat-Based Workflow System

## System Overview
This system integrates Next.js App Router, Google Sheets as a database, and a Chat Interface to manage product workflows.

**Key Features:**
1.  **Chat-driven Context**: The chat API maintains state (`currentSku`, `pending_intent`) to support multi-turn conversations.
2.  **Hybrid Navigation**: URL (`?sku=...`) and Chat Context are synchronized. URL is the source of truth for the active product.
3.  **Tooling**: Secure server actions for writing data (Tasks, Checklists) and read-only tools for searching (Products, Drive).

## Core Concepts

### 0. Security & Auth Hardening
-   **Server-Side Source of Truth**: The API ignores any `user` object sent in the request context. It always derives the user identity from the secure server-side session (`getServerSession`).
-   **Response Sanitization**: In production environments, the `user` object is stripped from the `updated_context` sent back to the client to prevent leakage of internal role/email data.

### 1. SKU Context & URL Sync
-   **URL as Truth**: When a user selects a product, the server sends a `set_url_sku` event. The client updates the URL.
-   **Context Merging**: The client sends the current URL SKU in every request body (`context.currentSku`). The server trusts this context unless it extracts a *new* SKU from the user's latest message.

### 2. Pending Intent Lifecycle
Handles flows where the user states an intent *before* providing the necessary context (SKU).
-   **Set**: User asks "Product Info" (no SKU). Server sets `pending_intent: { type: "product_info" }`.
-   **Replay**: User replies "TEST001". Server resolves SKU, sees `pending_intent`, and executes "product_info" for "TEST001".
-   **Clear**: **CRITICAL**: The server clears the intent by setting `pending_intent: null` (explicit null) in the response. The client merges this to clear its state.

### 3. UI Events
-   `choose_product`: Displays a card carousel for ambiguous search results.
-   `set_url_sku`: Forces the client to update the URL query parameter.
-   `show_confirmation`: (Checklist Agent) Asks for user approval before dangerous writes.

## Reproduction Steps (Traces)

To reproduce the traces provided in `traces.json`:

1.  **Login as Admin**: Access `/admin/system`.
2.  **Run Smoke Tests**: Click the "Run Smoke Tests" button. This executes the following logic:
    -   **Trace 1 (Missing SKU)**: Send "ขอข้อมูลสินค้า". Expect `pending_intent`.
    -   **Trace 2 (Resolution)**: Send "TEST001". Expect info & cleared intent.
    -   **Trace 3 (Ambiguous)**: Send "ambiguous". Expect `choose_product`.
3.  **Manual Flows (Checklist)**:
    -   Go to `/workspace?sku=TEST001`.
    -   Type "Create checklist". Expect Confirmation Card.

## Files Included
-   `route.ts`: Main Chat API handler (Router/Resolver/Executor).
-   `tools.ts`: Tool implementations (Search, Database).
-   `types.ts`: TypeScript definitions for Context and Events.
-   `ChatInterface.tsx`: Client-side chat component.
