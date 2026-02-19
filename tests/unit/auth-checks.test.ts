
import { validateAction } from '@/lib/workspace/auth-checks'

describe('Auth Checks', () => {
    it('should allow admin to perform any action', () => {
        expect(validateAction('admin', 'admin')).toBe(true)
        expect(validateAction('admin', 'write')).toBe(true)
        expect(validateAction('admin', 'read')).toBe(true)
    })

    it('should allow editor to write but not admin', () => {
        expect(validateAction('editor', 'write')).toBe(true)
        expect(validateAction('editor', 'read')).toBe(true)
        expect(validateAction('editor', 'admin')).toBe(false)
    })

    it('should allow viewer only read', () => {
        expect(validateAction('viewer', 'write')).toBe(false)
        expect(validateAction('viewer', 'read')).toBe(true)
        expect(validateAction('viewer', 'admin')).toBe(false)
    })

    it('should be case insensitive', () => {
        expect(validateAction('Admin', 'admin')).toBe(true)
        expect(validateAction('EDITOR', 'write')).toBe(true)
    })
})
