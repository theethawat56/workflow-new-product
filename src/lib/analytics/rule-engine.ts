import {
    GM_KEEP_THRESHOLD,
    GM_SCALE_THRESHOLD,
    VELOCITY_ACCEL_RATIO,
} from "./constants"
import type { Cohort, Seasonality, Verdict } from "./types"

export const VERDICT_META: Record<
    Verdict,
    { emoji: string; label: string; labelTh: string; className: string }
> = {
    SCALE: {
        emoji: "🚀",
        label: "SCALE",
        labelTh: "ดันหนัก",
        className: "bg-emerald-100 text-emerald-900 border-emerald-300",
    },
    KEEP: {
        emoji: "✅",
        label: "KEEP",
        labelTh: "ขายต่อ ไม่ลงงบเพิ่ม",
        className: "bg-sky-100 text-sky-900 border-sky-300",
    },
    WATCH: {
        emoji: "👀",
        label: "WATCH",
        labelTh: "เฝ้าดู",
        className: "bg-amber-100 text-amber-900 border-amber-300",
    },
    FIX: {
        emoji: "⚠️",
        label: "FIX",
        labelTh: "แก้ก่อน (margin/stock)",
        className: "bg-orange-100 text-orange-900 border-orange-300",
    },
    PHASE_OUT: {
        emoji: "🛑",
        label: "PHASE OUT",
        labelTh: "ล้างสต็อก",
        className: "bg-red-100 text-red-900 border-red-300",
    },
}

export interface RuleEngineInput {
    gmPct: number | null
    unitsYtd: number
    medianUnits: number
    currentStock: number | null
    reorderPoint: number
    minOrderQty: number
    coverDays: number | null
    velocityAccelerating: boolean
    seasonality: Seasonality
    nowMonth: number
    topChannel: string | null
    bestMarginChannel: string | null
    cohort: Cohort
}

export interface RuleEngineResult {
    verdict: Verdict
    reason: string
    actions: string[]
}

export function runRuleEngine(input: RuleEngineInput): RuleEngineResult {
    const {
        gmPct,
        unitsYtd,
        medianUnits,
        currentStock,
        reorderPoint,
        minOrderQty,
        coverDays,
        velocityAccelerating,
        seasonality,
        nowMonth,
        topChannel,
        bestMarginChannel,
    } = input

    const actions: string[] = []
    let verdict: Verdict = "WATCH"
    let reason = "ยอดและ margin อยู่ในช่วงปกติ — เฝ้าดูต่อ"

    if (gmPct != null && gmPct < 0) {
        verdict = "FIX"
        reason = "ขายต่ำกว่าทุน — ตั้งราคา/ตรวจ cost ก่อนดัน"
        actions.push(
            `ตั้งราคาใหม่ — GM% ปัจจุบัน ${gmPct.toFixed(1)}% (ขาดทุน)`,
            "ตรวจ weighted cost ใน po_costs และราคาขายแต่ละช่องทาง",
        )
        return { verdict, reason, actions }
    }

    if (unitsYtd === 0) {
        verdict = "WATCH"
        reason = "ยังไม่เริ่มขาย — เปิด listing/แคมเปญเปิดตัว"
        actions.push(
            "เปิด listing ครบทุก marketplace + LINE/FB",
            "วางแคมเปญเปิดตัวและติดตามยอดรายสัปดาห์",
        )
        return { verdict, reason, actions }
    }

    if (
        currentStock != null &&
        reorderPoint > 0 &&
        currentStock <= reorderPoint
    ) {
        verdict = "FIX"
        reason = `ใกล้/ขาดสต็อก — สั่งเพิ่ม ${Math.ceil(minOrderQty)} ชิ้น`
        actions.push(
            `สั่งเพิ่ม ${Math.ceil(minOrderQty)} ชิ้น (ROP ${Math.ceil(reorderPoint)} / สต็อก ${currentStock})`,
            coverDays != null
                ? `cover เหลือ ~${coverDays.toFixed(0)} วัน — เร่ง PO`
                : "อัปเดตสต็อกใน Stock_AT ให้ตรงจริง",
        )
        return { verdict, reason, actions }
    }

    if (
        gmPct != null &&
        gmPct < 25 &&
        unitsYtd < medianUnits * 0.3 &&
        currentStock != null &&
        reorderPoint > 0 &&
        currentStock > reorderPoint * 2
    ) {
        verdict = "PHASE_OUT"
        reason = "ยอดต่ำ + สต็อกค้าง — พิจารณาล้างสต็อก"
        actions.push(
            `ลดราคาเคลียร์สต็อก ${currentStock} ชิ้น (cover ${coverDays?.toFixed(0) ?? "—"} วัน)`,
            "หยุดสั่งเพิ่มและลดงบโฆษณา",
        )
        return { verdict, reason, actions }
    }

    if (
        gmPct != null &&
        gmPct >= GM_SCALE_THRESHOLD &&
        unitsYtd >= medianUnits
    ) {
        verdict = "SCALE"
        reason = "STAR — ทุ่มงบช่องทาง velocity สูง + ขยายช่อง margin สูง"
        if (topChannel) {
            actions.push(`เพิ่มงบโฆษณา ${topChannel} (ช่องทางยอดสูงสุด)`)
        }
        if (bestMarginChannel && bestMarginChannel !== topChannel) {
            actions.push(`ขยายช่องทาง ${bestMarginChannel} — GM% สูงกว่าช่องหลัก`)
        }
        actions.push(
            `ยอด YTD ${unitsYtd} ชิ้น (median cohort ${medianUnits}) · GM% ${gmPct.toFixed(1)}%`,
        )
        return { verdict, reason, actions }
    }

    if (gmPct != null && gmPct >= GM_SCALE_THRESHOLD && velocityAccelerating) {
        verdict = "SCALE"
        reason = "กำลังติดตลาด — เร่งของ+ad ก่อนคู่แข่งมา"
        actions.push(
            "⏫ velocity เร่งตัว — ใช้ค่า 30 วันล่าสุดสำหรับ ROP",
            `สั่งเพิ่ม ${Math.ceil(minOrderQty)} ชิ้นเผื่อ ramp`,
        )
        if (topChannel) actions.push(`เร่ง ad บน ${topChannel}`)
        return { verdict, reason, actions }
    }

    if (
        seasonality === "SEASONAL (summer)" &&
        nowMonth < 2
    ) {
        verdict = "SCALE"
        reason = "สินค้าหน้าร้อน — front-load ก่อนพีค ก.พ.–ก.ค."
        actions.push(
            "เตรียมล็อตก่อน ก.พ. (สินค้าหน้าร้อน)",
            `สั่งเพิ่ม ${Math.ceil(minOrderQty)} ชิ้นก่อนพีค`,
        )
        return { verdict, reason, actions }
    }

    if (
        gmPct != null &&
        gmPct < GM_KEEP_THRESHOLD &&
        unitsYtd >= medianUnits
    ) {
        verdict = "KEEP"
        reason = "cash cow margin บาง — ปล่อยขายเอง ไม่ลงงบ"
        actions.push(
            `GM% ${gmPct.toFixed(1)}% ต่ำกว่าเกณฑ์ดัน (${GM_SCALE_THRESHOLD}%) แต่ยอด ${unitsYtd} ชิ้นดี`,
            "ไม่เพิ่มงบโฆษณา — ดูแลสต็อกให้พอขาย",
        )
        return { verdict, reason, actions }
    }

    actions.push("ติดตามยอดรายเดือนและ GM% แยกช่องทาง")
    if (velocityAccelerating) {
        actions.push("velocity เร่งตัว — พร้อมสลับเป็น SCALE ถ้า GM% ดีขึ้น")
    }

    return { verdict, reason, actions }
}
