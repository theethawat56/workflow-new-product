
import { MockToolAdapter } from '@/lib/workspace/tools-adapter'
import { ChatRequest, ConfirmRequest } from '@/lib/workspace/types'
import OpenAI from 'openai'

// Define mock factory once (but we will remock or rely on it being hoisted)
const mockCreate = jest.fn()

jest.mock('openai', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => {
            return {
                chat: {
                    completions: {
                        create: mockCreate
                    }
                }
            }
        })
    }
})

describe('E2E: Chat Flow', () => {
    let adapter: MockToolAdapter
    let baseRequest: ChatRequest
    // Dynamic imports
    let chatHandler: any
    let confirmHandler: any

    beforeEach(() => {
        jest.resetModules() // Ensure we get a fresh module execution
        mockCreate.mockReset()

        // Re-require orchestrator-core so it runs `new OpenAI()` again with our mock
        // We need to use require because import is static
        const orchestrator = require('@/lib/workspace/orchestrator-core')
        chatHandler = orchestrator.chatHandler
        confirmHandler = orchestrator.confirmHandler

        adapter = new MockToolAdapter()

        baseRequest = {
            conversation_id: 'test-conv',
            messages: [],
            context: {
                user: { email: 'test@example.com', role: 'admin' },
                timezone: 'UTC'
            },
            last_user_message: {
                id: '1', role: 'user', content: 'test', timestamp: new Date().toISOString()
            }
        }
    })

    it('Scenario A: Open SKU Success (Read)', async () => {
        // 1. Plan
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: JSON.stringify({
                        intent: "search_product",
                        agents_to_call: [],
                        read_tools_to_call: [{ tool: "getProductBySku", args: { sku: "TEST-SKU-1" } }],
                        notes: "Found product"
                    })
                }
            }]
        })

        // 2. Synthesis
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: "Found product TEST-SKU-1" } }]
        })

        const response = await chatHandler({
            ...baseRequest,
            last_user_message: { ...baseRequest.last_user_message, content: "Show me TEST-SKU-1" }
        }, adapter)

        expect(response.assistant_message.content).toContain("Found product TEST-SKU-1")
        expect(response.updated_context.last_tool_results['getProductBySku'].sku_code).toBe("TEST-SKU-1")
    })

    it('Scenario D: Request Write -> Confirmation Card', async () => {
        // 1. Plan
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: JSON.stringify({
                        intent: "update_task",
                        agents_to_call: ["LaunchOps"],
                        read_tools_to_call: [{ tool: "listTasksByProduct", args: { productId: "p1" } }],
                        notes: "Updating task"
                    })
                }
            }]
        })

        // 2. LaunchOps Agent
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: JSON.stringify({
                        intent: "propose_update",
                        summary: "Proposing to mark task as done",
                        questions_for_user: [],
                        proposed_actions: [{ type: "tool_call", tool: "updateTaskStatus", args: { taskId: "t1", status: "Done" } }],
                        data_needed: [],
                        risk_flags: []
                    })
                }
            }]
        })

        // 3. Synthesis
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: "Please confirm update." } }]
        })

        const response = await chatHandler({
            ...baseRequest,
            last_user_message: { ...baseRequest.last_user_message, content: "Mark task t1 as Done" }
        }, adapter)

        expect(response.ui_events).toHaveLength(1)
        expect(response.ui_events[0].type).toBe("show_confirmation")

        const card = response.ui_events[0].payload
        expect(card.proposed_actions[0].tool).toBe("updateTaskStatus")
    })

    it('Scenario E: Confirm -> Execution -> Activity Log', async () => {
        const req: ConfirmRequest = {
            conversation_id: "test-conv",
            confirmation_id: "123",
            decision: "confirm",
            context: baseRequest.context
        }

        const response = await confirmHandler(req, adapter)

        expect(response.assistant_message.content).toContain("ดำเนินการเรียบร้อย")
        // Check MockToolAdapter state
        expect(adapter.activityLogs).toHaveLength(1)
        expect(adapter.activityLogs[0].action).toBe("update")
    })
})
