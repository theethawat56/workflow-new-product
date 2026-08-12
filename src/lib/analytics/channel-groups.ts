import { classifyOrderChannel } from "@/lib/sales/channel"
import type { ChannelGroup } from "./types"

export type { ChannelGroup } from "./types"

export const CHANNEL_GROUP_ORDER: ChannelGroup[] = [
    "Marketplace",
    "LINE",
    "POS",
    "Dealer-Wholesale",
    "WFM",
]

export function getChannelGroup(
    channelRaw: string,
    marketplaceName?: string,
    integrationName?: string,
): ChannelGroup {
    const raw = `${channelRaw} ${marketplaceName} ${integrationName}`.toLowerCase()

    if (/wfm|งานซ่อม|งานเคลม|claim|review|ของแถม|ฝากขาย/.test(raw)) {
        return "WFM"
    }
    if (/dealer|wholesale|b2b|ตัวแทน|distributor/.test(raw)) {
        return "Dealer-Wholesale"
    }

    const c = classifyOrderChannel(channelRaw, marketplaceName, integrationName)
    if (c.category === "MARKETPLACE") return "Marketplace"
    if (/line|facebook|fb\b/.test(c.channel.toLowerCase())) return "LINE"
    if (/pos|cash|dataslot/.test(c.channel.toLowerCase())) return "POS"

    return "Dealer-Wholesale"
}

export function buildChannelInsight(
    groups: Array<{ group: ChannelGroup; revenue: number; gmPct: number | null }>,
): string {
    const withRev = groups.filter((g) => g.revenue > 0)
    if (withRev.length === 0) return "ยังไม่มีข้อมูลยอดขายแยกช่องทาง"

    const topVol = [...withRev].sort((a, b) => b.revenue - a.revenue)[0]
    const withGm = withRev.filter((g) => g.gmPct != null)
    const topGm = withGm.length
        ? [...withGm].sort((a, b) => (b.gmPct ?? 0) - (a.gmPct ?? 0))[0]
        : null

    const volShare = (topVol.revenue / withRev.reduce((s, g) => s + g.revenue, 0)) * 100

    if (topGm && topGm.group !== topVol.group && topGm.gmPct != null && topVol.gmPct != null) {
        const gap = topGm.gmPct - topVol.gmPct
        if (gap >= 3) {
            return `${topVol.group} ทำ ${volShare.toFixed(0)}% ของยอด แต่ GM ต่ำกว่า ${topGm.group} ${gap.toFixed(0)}pp — มีพื้นที่ดันช่องทาง margin สูง`
        }
    }

    return `${topVol.group} เป็นช่องทางหลัก (${volShare.toFixed(0)}% ของยอด)`
}
