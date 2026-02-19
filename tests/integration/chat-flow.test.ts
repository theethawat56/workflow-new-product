import { POST } from "@/app/api/workspace/chat/route"
import { NextRequest } from "next/server"

// Mock dependencies
jest.mock("next-auth", () => ({
    getServerSession: jest.fn(() => Promise.resolve({
        user: { email: "tester@example.com", role: "admin" }
    }))
}))

jest.mock("@/app/api/auth/[...nextauth]/route", () => ({
    authOptions: {}
}))

jest.mock("@/lib/workspace/tools", () => ({
    getProductBySku: jest.fn((sku) => {
        if (sku === "TEST001") return Promise.resolve({ product_id: "p1", sku_code: "TEST001", product_name: "Test Product", status: "Active" })
        return Promise.resolve(null)
    }),
    searchProducts: jest.fn((query) => {
        if (query === "ambiguous") return Promise.resolve([
            { sku: "A1", productName: "Ambiguous 1", score: 80 },
            { sku: "A2", productName: "Ambiguous 2", score: 80 }
        ])
        if (query === "test") return Promise.resolve([{ sku: "TEST001", productName: "Test Product", score: 100 }])
        return Promise.resolve([])
    }),
    searchWorkspace: jest.fn(() => Promise.resolve({ products: [], tasks: [], files: [] })),
    createTasksBatchTool: jest.fn(() => Promise.resolve({ success: true, count: 5 })),
    launchProduct: jest.fn(() => Promise.resolve({ success: true }))
}))

jest.mock("@/lib/workspace/templates", () => ({
    getChecklistTemplate: jest.fn(() => ({
        name: "Test Template",
        tasks: [{ task_name: "Task 1", phase: "P1", default_owner_role: "Admin" }]
    }))
}))

describe("Chat API Integration Flows", () => {

    // Helper to create request
    const createReq = (body: any) => new NextRequest("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify(body)
    })

    it("Flow 1: Ask -> Pending Intent Set", async () => {
        const req = createReq({
            last_user_message: { content: "product info" }, // Ambiguous, no SKU
            context: { currentSku: null }
        })
        const res = await POST(req)
        const data = await res.json()

        expect(data.updated_context.pending_intent).toEqual({
            type: "product_info",
            original_text: "product info"
        })
        expect(data.assistant_message.content).toContain("ระบุ SKU") // Expect "specify SKU" or similar fallback/missing_sku message
    })

    it("Flow 2: Provide SKU -> Replay Intent -> Pending Intent Cleared", async () => {
        // Mock extractSku behavior by sending a text that regex catches
        const req = createReq({
            last_user_message: { content: "Please look at TEST001" },
            context: {
                currentSku: null,
                pending_intent: { type: "product_info", original_text: "product info" }
            }
        })
        const res = await POST(req)
        const data = await res.json()

        // Debug output if fails
        if (data.updated_context.currentSku !== "TEST001") {
            console.log("Flow 2 Debug:", JSON.stringify(data, null, 2))
        }

        expect(data.updated_context.currentSku).toBe("TEST001")
        expect(data.updated_context.pending_intent).toBeNull()
    })

    it("Flow 3: Ambiguous Selection -> Choose Product Event", async () => {
        const req = createReq({
            last_user_message: { content: "ambiguous" },
            context: { currentSku: null }
        })
        const res = await POST(req)
        const data = await res.json()

        expect(data.ui_events).toContainEqual(expect.objectContaining({ type: "choose_product" }))
        expect(data.assistant_message.content).toContain("เลือกสินค้า")
    })

    it("Flow 4: Checklist Creation -> Confirmation -> Execution", async () => {
        // Step 1: Request Checklist
        const req1 = createReq({
            last_user_message: { content: "create checklist" },
            context: { currentSku: "TEST001" } // Must have SKU context or provide it
        })
        const res1 = await POST(req1)
        const data1 = await res1.json()

        // Fix expectation: payload.data.type is where type lives
        expect(data1.ui_events).toContainEqual(expect.objectContaining({
            type: "show_confirmation",
            payload: expect.objectContaining({
                data: expect.objectContaining({ type: "create_checklist" })
            })
        }))

        // Step 2: Execute Action
        // The handler expects rawText to contain "EXECUTE_ACTION <JSON>"
        const actionPayload = JSON.stringify({
            type: "create_checklist",
            sku: "TEST001",
            productId: "p1",
            tasks: []
        })

        const req2 = createReq({
            last_user_message: { content: `EXECUTE_ACTION ${actionPayload}` },
            context: { currentSku: "TEST001" }
        })
        const res2 = await POST(req2)
        const data2 = await res2.json()

        expect(data2.assistant_message.content).toContain("Created 5 tasks")
    })
})
