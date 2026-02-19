
import { normalizeThaiCommand, resolveSku, listPendingTasks } from '@/lib/workspace/tools'
import * as dataSource from '@/lib/workspace/data-source'

// Mock the data-source module
jest.mock('@/lib/workspace/data-source', () => ({
    fetchSheet: jest.fn(),
    queryByColumn: jest.fn(),
}))

const mockFetchSheet = dataSource.fetchSheet as jest.Mock

describe('Workspace Tools Robustness', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('normalizeThaiCommand', () => {
        it('should normalize typos', () => {
            expect(normalizeThaiCommand("งานค่าง")).toBe("งานค้าง")
            expect(normalizeThaiCommand("งานค่างมีอะไรบ้าง")).toBe("งานค้างมีอะไรบ้าง")
            expect(normalizeThaiCommand("ค่าง")).toBe("ค้าง")
        })

        it('should trim and lowercase', () => {
            expect(normalizeThaiCommand("  Test  ")).toBe("test")
        })
    })

    describe('resolveSku', () => {
        const mockProducts = [
            { sku_code: "SKU123", product_name: "Test Product A" },
            { sku_code: "SKU456", product_name: "Test Product B" },
            { sku_code: "SKU789", product_name: "UniqueName" }
        ]

        it('should resolve exact SKU match', async () => {
            mockFetchSheet.mockResolvedValue(mockProducts)
            const result = await resolveSku("SKU123")
            expect(result).toEqual({ sku: "SKU123" })
        })

        it('should resolve case-insensitive SKU match', async () => {
            mockFetchSheet.mockResolvedValue(mockProducts)
            const result = await resolveSku("sku123")
            expect(result).toEqual({ sku: "SKU123" })
        })

        it('should resolve by exact product name', async () => {
            mockFetchSheet.mockResolvedValue(mockProducts)
            const result = await resolveSku("UniqueName")
            expect(result).toEqual({ sku: "SKU789" })
        })

        it('should return ambiguous candidates', async () => {
            mockFetchSheet.mockResolvedValue(mockProducts)
            const result = await resolveSku("Test Product")
            expect(result.candidates).toHaveLength(2)
            expect(result.candidates?.[0].sku).toBe("SKU123") // Score sort might vary but both match
        })

        it('should return not found', async () => {
            mockFetchSheet.mockResolvedValue(mockProducts)
            const result = await resolveSku("NonExistent")
            expect(result.error).toBe("not_found")
        })
    })

    describe('listPendingTasks Sheet Fallback', () => {
        it('should fallback to product_tasks if template_tasks has no status', async () => {
            // Mock calls
            mockFetchSheet.mockImplementation((sheet) => {
                if (sheet === "template_tasks") return Promise.resolve([{ task_name: "Template Task" }]) // No status
                if (sheet === "product_tasks") return Promise.resolve([{ task_name: "Real Task", status: "TODO" }])
                return Promise.resolve([])
            })

            const result = await listPendingTasks()

            // Should ignore template_tasks because no status col
            expect(result.stats.source).toBe("product_tasks")
            expect(result.total).toBe(1)
        })

        it('should NOT use template_tasks even if it has status (strict source)', async () => {
            mockFetchSheet.mockImplementation((sheet) => {
                if (sheet === "template_tasks") return Promise.resolve([{ task_name: "Task 1", status: "TODO" }])
                if (sheet === "product_tasks") return Promise.resolve([])
                return Promise.resolve([])
            })

            const result = await listPendingTasks()
            expect(result.stats.source).toBe("product_tasks")
            expect(result.total).toBe(0)
        })

        it('should handle map columns properly', async () => {
            mockFetchSheet.mockImplementation((sheet) => {
                if (sheet === "product_tasks") return Promise.resolve([
                    { "งาน": "Task A", "สถานะ": "รอดำเนินการ", "กำหนด": "2025-01-01" } // Thai columns
                ])
                return Promise.resolve([]) // others empty
            })

            const result = await listPendingTasks()
            expect(result.stats.source).toBe("product_tasks")
            expect(result.total).toBe(1)
            expect(result.tasks[0].status).toBe("รอดำเนินการ")
            expect(result.tasks[0].task_name).toBe("Task A")
        })
    })
})
