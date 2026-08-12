import { loadWhatIfData } from "@/lib/analytics/what-if"
import { WhatIfDashboard } from "@/components/analytics/WhatIfDashboard"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    title: "What-if Dashboard — สินค้าใหม่ 2026",
    description: "พยากรณ์ยอดขายแบบปรับตัวแปรสด เทียบยอดจริงจาก Google Sheet",
}

export default async function WhatIfPage() {
    const data = await loadWhatIfData()
    return <WhatIfDashboard data={data} />
}
