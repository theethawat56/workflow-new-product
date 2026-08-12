/**
 * Net GP channel deductions (RobotMaker standard).
 *
 * Marketplace (Shopee / Lazada / TikTok): VAT 7% + Com 23% + Shipping 2% = 32%
 * Direct (Direct / Line / FB / POS):       VAT 7% + Installment 10% + Shipping 2% = 19%
 */

export type ChannelCategory = "MARKETPLACE" | "DIRECT" | "OTHER"

export interface ChannelClassification {
    channel: string
    category: ChannelCategory
    deduction: number
}

/** VAT 7% + Com 23% + Shipping 2% */
export const MARKETPLACE_DEDUCTION = 0.32

/** VAT 7% + Installment 10% + Shipping 2% */
export const DIRECT_DEDUCTION = 0.19

export const DEDUCTION_LABELS = {
    MARKETPLACE:
        "Marketplace (Shopee/Lazada/TikTok): VAT 7% + Com 23% + Shipping 2% = 32%",
    DIRECT:
        "Direct (Direct/Line/FB/POS): VAT 7% + Installment 10% + Shipping 2% = 19%",
} as const

export function classifyOrderChannel(
    salesChannel: string | undefined,
    marketplaceName?: string,
    integrationName?: string,
): ChannelClassification {
    const raw = ((salesChannel ?? "") || (marketplaceName ?? "") || (integrationName ?? ""))
        .toString()
        .trim()
    const lower = raw.toLowerCase()

    if (/shopee/.test(lower))
        return { channel: "Shopee", category: "MARKETPLACE", deduction: MARKETPLACE_DEDUCTION }
    if (/lazada/.test(lower))
        return { channel: "Lazada", category: "MARKETPLACE", deduction: MARKETPLACE_DEDUCTION }
    if (/tiktok/.test(lower))
        return { channel: "TikTok", category: "MARKETPLACE", deduction: MARKETPLACE_DEDUCTION }
    if (/wfm|งานซ่อม|งานเคลม|claim|review|ของแถม|ฝากขาย/.test(lower))
        return { channel: "Service/Claim", category: "OTHER", deduction: 0 }
    if (/line/.test(lower))
        return { channel: "Line", category: "DIRECT", deduction: DIRECT_DEDUCTION }
    if (/facebook|fb\b/.test(lower))
        return { channel: "Facebook", category: "DIRECT", deduction: DIRECT_DEDUCTION }
    if (/pos|dataslot|เงินสด|cash/.test(lower))
        return { channel: "POS/Cash", category: "DIRECT", deduction: DIRECT_DEDUCTION }
    if (/sale\s*online|direct/.test(lower))
        return { channel: "Direct Online", category: "DIRECT", deduction: DIRECT_DEDUCTION }
    if (raw) return { channel: raw, category: "DIRECT", deduction: DIRECT_DEDUCTION }
    return { channel: "Unknown", category: "DIRECT", deduction: DIRECT_DEDUCTION }
}
