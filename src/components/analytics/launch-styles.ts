import type { CellStatus, LaunchVerdict } from "@/lib/analytics/launch-constants"
import { cn } from "@/lib/utils"

export const VERDICT_STYLE: Record<LaunchVerdict, string> = {
    "ON-TRACK": "bg-emerald-100 text-emerald-800 border-emerald-300",
    BEHIND: "bg-amber-100 text-amber-800 border-amber-300",
    "STOCK-RISK": "bg-red-100 text-red-800 border-red-300",
    "MARGIN-FAIL": "bg-red-100 text-red-900 border-red-400",
    "OVER-SEEDING": "bg-orange-100 text-orange-900 border-orange-300",
}

export const SCATTER_COLORS: Record<LaunchVerdict, string> = {
    "ON-TRACK": "#10b981",
    BEHIND: "#f59e0b",
    "STOCK-RISK": "#ef4444",
    "MARGIN-FAIL": "#dc2626",
    "OVER-SEEDING": "#ea580c",
}

export const ALERT_STYLE: Record<string, string> = {
    "STOCK-RISK": "border-red-300 bg-red-50",
    "OVER-SEEDING": "border-orange-300 bg-orange-50",
    "BUDGET-OVER": "border-amber-300 bg-amber-50",
    "MARGIN-FAIL": "border-red-400 bg-red-50",
    "SWITCH-TO-PAID": "border-blue-300 bg-blue-50",
}

export function cellStatusClass(status: CellStatus): string {
    if (status === "hit") return "text-emerald-700 font-medium bg-emerald-50"
    if (status === "near") return "text-amber-700 font-medium bg-amber-50"
    if (status === "miss") return "text-red-600 font-medium bg-red-50"
    return "text-muted-foreground"
}

export function verdictLabel(v: LaunchVerdict): string {
    return v
}
