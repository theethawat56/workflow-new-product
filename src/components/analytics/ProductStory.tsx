import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AnalyticsOverview } from "@/lib/analytics/types"
import { fmtThb, fmtPct, fmtPctRaw } from "@/lib/analytics/format"
import { SkuLink } from "@/components/analytics/SkuLink"
import { TrendingUp, TrendingDown, Sparkles, Target, Coins } from "lucide-react"

export function ProductStory({ data }: { data: AnalyticsOverview }) {
    const sharePct = data.newProductSharePct * 100
    const targetLow = data.newProductShareTargetLow * 100
    const targetHigh = data.newProductShareTargetHigh * 100
    const newRev = data.new2026Rev + data.new2025Rev
    const year = data.ytd2026To.slice(0, 4)
    const priorYear = data.ytd2025To.slice(0, 4)

    const gpUp = (data.gpYoYPct ?? 0) > 0
    const revUp = data.revYoYPct >= 0
    const topDriver = data.topGainers[0] ?? null
    const topDrag = data.topDecliners[0] ?? null

    // Growth narrative
    const shareVerb =
        sharePct >= targetHigh
            ? `เกินเป้า ${targetHigh.toFixed(0)}% แล้ว`
            : sharePct >= targetLow
              ? `อยู่ในกรอบเป้า ${targetLow.toFixed(0)}–${targetHigh.toFixed(0)}%`
              : `ยังต่ำกว่าเป้า ${targetLow.toFixed(0)}%`

    const growthSummary = `สินค้าใหม่ (New ${year} + New ${priorYear}) ทำรายได้ ${fmtThb(
        newRev,
    )} คิดเป็น ${sharePct.toFixed(1)}% ของรายได้รวม — ${shareVerb}. รายได้รวม ${
        revUp ? "เติบโต" : "ลดลง"
    } ${fmtPct(Math.abs(data.revYoYPct))} เทียบช่วงเดียวกันปี ${priorYear}.`

    // GP narrative
    let gpSummary: string
    if (data.gpYoYPct == null) {
        gpSummary = `กำไรขั้นต้น (GP) ปีนี้อยู่ที่ ${fmtThb(
            data.totalGrossProfitYtd2026,
        )} (GM% ${fmtPctRaw(data.totalGrossMarginPct)}). ยังไม่มีฐานปี ${priorYear} ให้เทียบ.`
    } else {
        const ppText =
            data.gpMarginDeltaPp != null
                ? ` margin ${data.gpMarginDeltaPp >= 0 ? "+" : ""}${data.gpMarginDeltaPp.toFixed(
                      1,
                  )}pp (${fmtPctRaw(data.totalGrossMarginPct2025)} → ${fmtPctRaw(
                      data.totalGrossMarginPct,
                  )})`
                : ""
        gpSummary = `กำไรขั้นต้น (GP) ${
            gpUp ? "เพิ่มขึ้น" : "ลดลง"
        } ${fmtPct(Math.abs(data.gpYoYPct))} จาก ${fmtThb(
            data.totalGrossProfitYtd2025,
        )} เป็น ${fmtThb(data.totalGrossProfitYtd2026)} เทียบ YTD ปี ${priorYear}.${ppText}`
    }

    return (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Product Story — ภาพรวมศักยภาพการเติบโต & กำไร
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                    {/* Growth */}
                    <div className="rounded-lg border bg-card p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Target className="w-4 h-4 text-emerald-600" />
                            ศักยภาพการเติบโต (Growth potential)
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {growthSummary}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <Badge
                                variant="outline"
                                className={
                                    sharePct >= targetLow
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                        : "bg-amber-100 text-amber-800 border-amber-200"
                                }
                            >
                                New share {sharePct.toFixed(1)}%
                            </Badge>
                            <Badge
                                variant="outline"
                                className={
                                    revUp
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                        : "bg-red-100 text-red-800 border-red-200"
                                }
                            >
                                {revUp ? (
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                ) : (
                                    <TrendingDown className="w-3 h-3 mr-1" />
                                )}
                                Rev {fmtPct(data.revYoYPct)} YoY
                            </Badge>
                        </div>
                    </div>

                    {/* GP */}
                    <div className="rounded-lg border bg-card p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Coins className="w-4 h-4 text-amber-600" />
                            กำไรขั้นต้นเพิ่มขึ้นไหม? (GP trend)
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {gpSummary}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {data.gpYoYPct != null && (
                                <Badge
                                    variant="outline"
                                    className={
                                        gpUp
                                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                            : "bg-red-100 text-red-800 border-red-200"
                                    }
                                >
                                    {gpUp ? (
                                        <TrendingUp className="w-3 h-3 mr-1" />
                                    ) : (
                                        <TrendingDown className="w-3 h-3 mr-1" />
                                    )}
                                    GP {fmtPct(data.gpYoYPct)} YoY
                                </Badge>
                            )}
                            <Badge variant="outline">
                                GM% {fmtPctRaw(data.totalGrossMarginPct)}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Drivers */}
                {(topDriver || topDrag) && (
                    <div className="text-sm flex flex-wrap gap-x-6 gap-y-1 border-t pt-3">
                        {topDriver && (
                            <span className="text-muted-foreground">
                                ตัวขับเคลื่อนหลัก:{" "}
                                <SkuLink sku={topDriver.sku} className="font-medium text-foreground">
                                    {topDriver.productName}
                                </SkuLink>{" "}
                                <span className="text-emerald-600">+{fmtThb(topDriver.delta)}</span>
                            </span>
                        )}
                        {topDrag && (
                            <span className="text-muted-foreground">
                                ตัวฉุดหลัก:{" "}
                                <SkuLink sku={topDrag.sku} className="font-medium text-foreground">
                                    {topDrag.productName}
                                </SkuLink>{" "}
                                <span className="text-red-600">{fmtThb(topDrag.delta)}</span>
                            </span>
                        )}
                    </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                    GP คำนวณหลังหักช่องทาง (Marketplace −32% / Direct −19%) · เทียบ YTD{" "}
                    {data.ytd2026From} → {data.ytd2026To} กับ {data.ytd2025From} →{" "}
                    {data.ytd2025To}
                </p>
            </CardContent>
        </Card>
    )
}
