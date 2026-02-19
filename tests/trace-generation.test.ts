
import { POST } from '@/app/api/workspace/chat/route'
import { NextRequest, NextResponse } from 'next/server'

// Mocks
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
    authOptions: {}
}))

jest.mock('next-auth', () => ({
    getServerSession: jest.fn().mockResolvedValue({
        user: { email: 'test@example.com', role: 'Viewer' }
    }),
    default: jest.fn()
}))

// Mock Data Source
jest.mock('@/lib/workspace/data-source', () => ({
    fetchSheet: jest.fn(),
    queryByColumn: jest.fn()
}))

import { fetchSheet } from '@/lib/workspace/data-source'
const mockFetchSheet = fetchSheet as jest.Mock

// Mock Data
const MOCK_PRODUCTS = [
    { sku_code: "SKU-001", product_name: "New Meari", product_id: "PID-001", status: "Active" },
    { sku_code: "SKU-002", product_name: "Old Meari", product_id: "PID-002", status: "Active" },
    { sku_code: "SKU-003", product_name: "Meari Pro", product_id: "PID-003", status: "Active" },
    { sku_code: "SKU-004", product_name: "Camera A", product_id: "PID-004", status: "Active" }
]

const MOCK_TASKS = [
    { product_task_id: "T1", product_id: "PID-001", task_name: "Check Stock", status: "TODO", due_date: "2025-12-31" },
    { product_task_id: "T2", product_id: "PID-001", task_name: "Urgent Fix", status: "DOING", priority: "High", due_date: "2024-01-01" }, // Overdue
    { product_task_id: "T3", product_id: "PID-002", task_name: "Review", status: "TODO" }
]

describe('Trace Generation', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockFetchSheet.mockImplementation((sheet) => {
            if (sheet === "products") return Promise.resolve(MOCK_PRODUCTS)
            if (sheet === "product_tasks") return Promise.resolve(MOCK_TASKS)
            return Promise.resolve([])
        })
    })

    const runChat = async (message: string, context: any = {}) => {
        const req = new NextRequest('http://localhost:3000/api/workspace/chat', {
            method: 'POST',
            body: JSON.stringify({
                last_user_message: { content: message, role: 'user' },
                context: { ...context, currentSku: context.currentSku || null },
                history: []
            })
        })
        const res = await POST(req)
        const json = await res.json()
        return json
    }

    it('Trace 1: Success "New Meari" (Name Resolution)', async () => {
        console.log("\n--- TRACE 1: Success (Name Resolution) ---")
        const res = await runChat("งานค้าง New Meari") // "New Meari" -> SKU-001 -> PID-001
        console.log(JSON.stringify(res.debug_trace, null, 2))

        expect(res.debug_trace.product_id_resolved).toBe("PID-001")
        expect(res.debug_trace.sku_resolved).toBe("SKU-001")
        expect(res.ui_events.find((e: any) => e.type === "tasks_list")).toBeTruthy()
    })

    it('Trace 2: Success "งานค่าง" (Typo + Context SKU)', async () => {
        console.log("\n--- TRACE 2: Success (Typo + Context) ---")
        const res = await runChat("งานค่าง", { currentSku: "SKU-001" })
        // Logic: Typo "งานค่าง" -> "งานค้าง" (tasks_summary). Context "SKU-001".
        // listPendingTasks({ sku: "SKU-001" }) -> resolves to PID-001.
        console.log(JSON.stringify(res.debug_trace, null, 2))

        expect(res.debug_trace.normalized_text).toContain("งานค้าง")
        expect(res.debug_trace.product_id_resolved).toBe("PID-001")
        expect(res.ui_events.find((e: any) => e.type === "tasks_list")).toBeTruthy()
    })

    it('Trace 3: Ambiguous "Meari" (Select Product)', async () => {
        console.log("\n--- TRACE 3: Ambiguous Name ---")
        const res = await runChat("งานค้าง Meari")
        // "Meari" matches "New Meari", "Old Meari", "Meari Pro" -> Ambiguous
        console.log(JSON.stringify(res.debug_trace, null, 2))

        expect(res.debug_trace.router_decision).toBe("choose_product")
        expect(res.ui_events.find((e: any) => e.type === "choose_product")).toBeTruthy()
    })
})
