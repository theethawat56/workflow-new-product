// Jest setup file
// Load environment variables for testing if needed
import { loadEnvConfig } from '@next/env'

const projectDir = process.cwd()
loadEnvConfig(projectDir)

// Mock uuid to avoid ESM issues and ensure deterministic tests
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-1234'
}))
