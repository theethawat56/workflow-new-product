import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
})

// Add any custom config to be passed to Jest
const config: Config = {
    coverageProvider: 'v8',
    testEnvironment: 'node', // Use node for backend tests
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testMatch: ['**/tests/**/*.test.ts'],
    // Allow Jest to transform specific node_modules that are ESM only
    transformIgnorePatterns: [
        '/node_modules/(?!(uuid|openai|node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)/)',
    ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
