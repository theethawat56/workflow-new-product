
import { MockToolAdapter } from '@/lib/workspace/tools-adapter'

describe('MockToolAdapter', () => {
    let adapter: MockToolAdapter

    beforeEach(() => {
        adapter = new MockToolAdapter()
    })

    it('should return mock product', async () => {
        const product = await adapter.getProductBySku('TEST-SKU-1')
        expect(product).toBeDefined()
        expect(product?.sku_code).toBe('TEST-SKU-1')
    })

    it('should return null for unknown sku', async () => {
        const product = await adapter.getProductBySku('UNKNOWN')
        expect(product).toBeNull()
    })

    it('should search products', async () => {
        const results = await adapter.searchProducts('Test')
        expect(results.length).toBeGreaterThan(0)
        expect(results[0].sku).toBe('TEST-SKU-1')
    })

    it('should update task status', async () => {
        const result = await adapter.updateTaskStatus('t1', 'p1', 'Done')
        expect(result.success).toBe(true)

        // Verify internal state update (white-box test for mock)
        const task = await adapter.listTasksByProduct('p1')
        expect(task[0].status).toBe('Done')
    })

    it('should log activity', async () => {
        await adapter.appendActivityLog('task', 't1', 'update', 'test@example.com', null, { status: 'Done' })
        expect(adapter.activityLogs.length).toBe(1)
        expect(adapter.activityLogs[0].action).toBe('update')
    })
})
