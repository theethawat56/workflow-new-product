import { parse, isValid, format } from "date-fns"
import { Channel, BudgetType, KolRow, RawKolRowSchema, RawSalesRowSchema, SalesRow } from "./types"
import { z } from "zod"

// Helper: Normalize Channel
export function normalizeChannel(raw: string | undefined): Channel {
    const s = (raw || "").trim().toLowerCase()
    if (s.includes("tiktok")) return "TikTok"
    if (s.includes("ig") || s.includes("instagram")) return "Instagram"
    if (s.includes("youtube") || s.includes("yt")) return "YouTube"
    return "Other"
}

// Helper: Parse Date (Thai/UK -> YYYY-MM-DD)
// Handles YYYY-MM-DD, DD/MM/YYYY, Excel Serial
export function parseSheetDate(raw: string | undefined): string | null {
    if (!raw) return null

    // 1. Already ISO?
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

    // 2. Excel Serial
    const num = parseFloat(raw)
    if (!isNaN(num) && num > 30000 && num < 60000) {
        // Excel base date 1899-12-30
        const date = new Date((num - 25569) * 86400 * 1000)
        return isValid(date) ? format(date, 'yyyy-MM-dd') : null
    }

    // 3. M/D/YYYY (US — KOL sheet / Dataslot sync)
    const parts = raw.split(/[\/-]/)
    if (parts.length === 3) {
        const a = parseInt(parts[0], 10)
        const b = parseInt(parts[1], 10)
        let y = parseInt(parts[2], 10)
        if (y < 100) y += 2000
        if (!isNaN(a) && !isNaN(b) && !isNaN(y)) {
            // US: month/day/year when first part ≤ 12 and second ≤ 31
            if (a >= 1 && a <= 12 && b >= 1 && b <= 31) {
                const usDate = new Date(y, a - 1, b)
                if (isValid(usDate)) return format(usDate, "yyyy-MM-dd")
            }
            // DD/MM/YYYY fallback
            if (b >= 1 && b <= 12 && a >= 1 && a <= 31) {
                const euDate = new Date(y, b - 1, a)
                if (isValid(euDate)) return format(euDate, "yyyy-MM-dd")
            }
        }
    }

    return null
}

// Helper: Clean Number
export function cleanNumber(raw: any): number {
    if (typeof raw === 'number') return raw
    if (!raw) return 0
    const str = String(raw).replace(/,/g, '').replace(/[^\d.-]/g, '')
    const val = parseFloat(str)
    return isNaN(val) ? 0 : val
}

// Normalize KOL Row
export function normalizeKolRow(index: number, raw: any, qualityIssues: any[]): KolRow | null {
    const parsed = RawKolRowSchema.parse(raw)

    // Date
    const postDate = parseSheetDate(parsed["Post Date"])
    if (!postDate) {
        // Log quality issue?
        return null // Skip invalid dates required by contract
    }

    // SKU
    const sku = (parsed["SKU"] || "").trim()
    if (!sku) return null

    // Channel
    const channel = normalizeChannel(parsed["Channel"])

    // Budget (Priority: Final > Amount)
    let budget = cleanNumber(parsed["Budget Final"])
    if (budget === 0) {
        budget = cleanNumber(parsed["Budget amount"])
    }

    // Product Name Fallback
    const productName = (
        parsed["Product Name"] ||
        parsed["Product"] ||
        parsed["Product name"] ||
        parsed["Item Name"] ||
        parsed["SKU Name"] ||
        ""
    )
    const productNameStr = (typeof productName === 'string' ? productName : "").trim()

    return {
        id: `kol-${index}-${postDate}-${sku}`,
        postDate,
        pic: (parsed["PIC"] || "Unassigned").trim(),
        kolName: (parsed["KOL Name"] || "Unknown").trim(),
        channel,
        sku,
        budgetAmount: budget,
        productName: productNameStr, // Might be empty, will fallback to sales later
        viewed: cleanNumber(parsed["Viewed"]),
        link: parsed["Link"] || parsed["Asset Link (drive)"],
    }
}

// Normalize Sales Row
export function normalizeSalesRow(index: number, raw: any): SalesRow | null {
    const parsed = RawSalesRowSchema.parse(raw)

    const date = parseSheetDate(parsed["Date"])
    if (!date) return null

    const sku = (parsed["SKU"] || "").trim()
    if (!sku) return null

    return {
        id: `sale-${index}-${date}-${sku}`,
        date,
        sku,
        revenue: cleanNumber(parsed["Revenue"]),
        unitsSold: cleanNumber(parsed["Units Sold"]),
        productName: (parsed["Product Name"] || "").trim()
    }
}
