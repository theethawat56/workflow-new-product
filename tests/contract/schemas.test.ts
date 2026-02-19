
import { HandoffContractSchema, OrchestratorPlanSchema } from '@/lib/workspace/types' // Assuming types exported Zod schemas
// Wait, types.ts exported Interfaces, but registry.ts exported Schemas? 
// Let's check where Schemas are. They were in registry.ts during development.
import { HandoffContractSchema, OrchestratorPlanSchema } from '@/lib/workspace/agents/registry'

describe('Contract Tests: JSON Schemas', () => {

    describe('HandoffContract V1', () => {
        it('should validate a correct handoff object', () => {
            const valid = {
                intent: "update_task",
                summary: "User wants to mark task as done",
                questions_for_user: [],
                proposed_actions: [
                    { type: "tool_call", tool: "updateTaskStatus", args: { taskId: "t1", status: "Done" } }
                ],
                data_needed: [],
                risk_flags: []
            }
            const result = HandoffContractSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should fail if required fields are missing', () => {
            const invalid = {
                intent: "update_task",
                // missing summary
                questions_for_user: []
            }
            const result = HandoffContractSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })

        it('should enforce strict structure on proposed_actions', () => {
            const invalidAction = {
                intent: "test",
                summary: "test",
                questions_for_user: [],
                proposed_actions: [
                    { type: "invalid_type", tool: "foo", args: {} }
                ],
                data_needed: [],
                risk_flags: []
            }
            const result = HandoffContractSchema.safeParse(invalidAction)
            expect(result.success).toBe(false)
        })
    })

    describe('Orchestrator Plan', () => {
        it('should validate a correct plan', () => {
            const valid = {
                intent: "inquiry",
                agents_to_call: ["SalesInsight", "LaunchOps"],
                read_tools_to_call: [
                    { tool: "getProductBySku", args: { sku: "TEST" } }
                ],
                notes: "Checking sales and tasks"
            }
            const result = OrchestratorPlanSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should validate empty calls', () => {
            const valid = {
                intent: "greeting",
                agents_to_call: [],
                read_tools_to_call: [],
                notes: "Just saying hello"
            }
            const result = OrchestratorPlanSchema.safeParse(valid)
            expect(result.success).toBe(true)
        })

        it('should fail on invalid agent names', () => {
            const invalid = {
                intent: "test",
                agents_to_call: ["UnknownAgent"],
                read_tools_to_call: [],
                notes: ""
            }
            const result = OrchestratorPlanSchema.safeParse(invalid)
            expect(result.success).toBe(false)
        })
    })
})
