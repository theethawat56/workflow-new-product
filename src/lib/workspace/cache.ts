import { SheetName } from "@/lib/db/schema"

interface CacheEntry<T> {
    data: T[]
    timestamp: number
}

// 5 Minutes Default TTL
const DEFAULT_TTL = 5 * 60 * 1000

class SimpleCache {
    private cache: Map<string, CacheEntry<any>> = new Map()

    set<T>(key: string, data: T[], ttl: number = DEFAULT_TTL) {
        this.cache.set(key, {
            data,
            timestamp: Date.now() + ttl
        })
    }

    get<T>(key: string): T[] | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        if (Date.now() > entry.timestamp) {
            this.cache.delete(key)
            return null
        }

        return entry.data as T[]
    }

    clear(key?: string) {
        if (key) {
            this.cache.delete(key)
        } else {
            this.cache.clear()
        }
    }
}

export const sheetCache = new SimpleCache()
