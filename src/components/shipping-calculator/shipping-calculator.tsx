"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Ship,
    Truck,
    Zap,
    Plus,
    Trash2,
    Copy,
    Check,
    Ruler,
    Box,
    Package,
    Calculator,
    Coins,
    Receipt,
    Sparkles,
    TrendingUp,
    Tag,
    Wallet,
    Percent,
    Zap as Bolt,
} from "lucide-react"

type TransportMode = "sea" | "land" | "express"
type ProductCategory = "A" | "B" | "C"
type InputMode = "dimensions" | "direct"
type Currency = "THB" | "RMB" | "USD"

// Rate is THB as source of truth (per CBM and per Kg)
interface RateEntry {
    perCBM: number
    perKg: number
}

const RATE_TABLE_THB: Record<TransportMode, Record<ProductCategory, RateEntry>> = {
    sea: {
        A: { perCBM: 4500, perKg: 30 },
        B: { perCBM: 6500, perKg: 45 },
        C: { perCBM: 9500, perKg: 65 },
    },
    land: {
        A: { perCBM: 5500, perKg: 40 },
        B: { perCBM: 7500, perKg: 55 },
        C: { perCBM: 10500, perKg: 75 },
    },
    express: {
        A: { perCBM: 8500, perKg: 80 },
        B: { perCBM: 11500, perKg: 120 },
        C: { perCBM: 15500, perKg: 180 },
    },
}

const TRANSPORT_INFO: Record<TransportMode, { label: string; desc: string; Icon: typeof Ship }> = {
    sea: { label: "Sea (Ship)", desc: "25–40 days · cheapest", Icon: Ship },
    land: { label: "Land (Truck)", desc: "7–12 days · balanced", Icon: Truck },
    express: { label: "Express", desc: "3–5 days · fastest", Icon: Zap },
}

const CATEGORY_INFO: Record<ProductCategory, { label: string; desc: string }> = {
    A: { label: "Type A", desc: "General goods · เสื้อผ้า, ของใช้ทั่วไป" },
    B: { label: "Type B", desc: "Special goods · เครื่องสำอาง, อาหารเสริม, อิเล็กทรอนิกส์" },
    C: { label: "Type C", desc: "Brand / Sensitive · สินค้าแบรนด์, ลิขสิทธิ์" },
}

interface Item {
    id: string
    name: string
    mode: InputMode
    category: ProductCategory
    width: string // cm
    length: string // cm
    height: string // cm
    weightPerCarton: string // kg
    cartons: string
    directCBM: string
    directWeight: string
    units: string // total units (for per-unit cost)
}

type ChargeBasis = "per_cbm" | "per_kg" | "per_shipment" | "per_carton"

interface ExtraCharge {
    id: string
    label: string
    amount: string // THB (source of truth)
    basis: ChargeBasis
}

const CHARGE_BASIS_LABEL: Record<ChargeBasis, string> = {
    per_cbm: "per CBM",
    per_kg: "per Kg",
    per_shipment: "per Shipment (SET)",
    per_carton: "per Carton",
}

const newCharge = (partial: Partial<ExtraCharge> = {}): ExtraCharge => ({
    id: Math.random().toString(36).slice(2, 9),
    label: partial.label ?? "",
    amount: partial.amount ?? "",
    basis: partial.basis ?? "per_cbm",
})

const LCL_SEA_PRESET: ExtraCharge[] = [
    newCharge({ label: "O/F (Ocean Freight)", amount: "0", basis: "per_cbm" }),
    newCharge({ label: "Local Charge", amount: "1030", basis: "per_cbm" }),
    newCharge({ label: "D/O (Delivery Order)", amount: "1350", basis: "per_shipment" }),
]

const LAND_PRESET: ExtraCharge[] = [
    newCharge({ label: "Customs Clearance", amount: "2500", basis: "per_shipment" }),
    newCharge({ label: "Delivery Fee", amount: "1500", basis: "per_shipment" }),
]

const EXPRESS_PRESET: ExtraCharge[] = [
    newCharge({ label: "Handling Fee", amount: "500", basis: "per_shipment" }),
]

// Last-mile delivery (warehouse → customer) — THB per parcel, Thailand 2025
// Tiers defined by max chargeable weight (kg). Last tier covers oversize.
type LastMileCarrier = "dhl" | "shopee" | "avg" | "custom"

interface LastMileTier {
    maxKg: number
    price: number
}

const LAST_MILE_RATES: Record<Exclude<LastMileCarrier, "custom">, LastMileTier[]> = {
    dhl: [
        { maxKg: 1, price: 50 },
        { maxKg: 3, price: 70 },
        { maxKg: 5, price: 90 },
        { maxKg: 10, price: 130 },
        { maxKg: 20, price: 200 },
        { maxKg: Infinity, price: 300 },
    ],
    shopee: [
        { maxKg: 1, price: 30 },
        { maxKg: 3, price: 45 },
        { maxKg: 5, price: 65 },
        { maxKg: 10, price: 95 },
        { maxKg: 20, price: 160 },
        { maxKg: Infinity, price: 260 },
    ],
    avg: [
        { maxKg: 1, price: 40 },
        { maxKg: 3, price: 55 },
        { maxKg: 5, price: 75 },
        { maxKg: 10, price: 110 },
        { maxKg: 20, price: 180 },
        { maxKg: Infinity, price: 280 },
    ],
}

const lookupLastMile = (weightKg: number, tiers: LastMileTier[]): number => {
    if (weightKg <= 0) return 0
    for (const t of tiers) {
        if (weightKg <= t.maxKg) return t.price
    }
    return tiers[tiers.length - 1].price
}

const LAST_MILE_LABEL: Record<LastMileCarrier, string> = {
    dhl: "DHL eCommerce",
    shopee: "Shopee SPX Express",
    avg: "ค่าเฉลี่ย (DHL + Shopee)",
    custom: "กำหนดเอง",
}

const newItem = (): Item => ({
    id: Math.random().toString(36).slice(2, 9),
    name: "",
    mode: "dimensions",
    category: "A",
    width: "",
    length: "",
    height: "",
    weightPerCarton: "",
    cartons: "1",
    directCBM: "",
    directWeight: "",
    units: "",
})

const n = (v: string) => {
    const x = parseFloat(v.replace(/,/g, ""))
    return isFinite(x) ? x : 0
}

const fmt = (v: number, digits = 2) =>
    v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function ShippingCalculator() {
    const [transport, setTransport] = useState<TransportMode>("sea")
    const [items, setItems] = useState<Item[]>([newItem()])
    const [volumetricDivisor, setVolumetricDivisor] = useState("167")
    const [displayCurrency, setDisplayCurrency] = useState<Currency>("THB")
    const [rmbRate, setRmbRate] = useState("5.00") // 1 RMB = X THB
    const [usdRate, setUsdRate] = useState("36.00") // 1 USD = X THB
    const [productValueTHB, setProductValueTHB] = useState("")
    const [taxDutyPct, setTaxDutyPct] = useState("0")
    const [notes, setNotes] = useState("")
    const [copied, setCopied] = useState(false)
    const [overrideRates, setOverrideRates] = useState(false)
    const [rates, setRates] = useState(RATE_TABLE_THB)
    const [useBaseRate, setUseBaseRate] = useState(true)
    const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([])

    // Pricing & Cost state
    const [costCurrency, setCostCurrency] = useState<Currency>("RMB")
    const [costPerUnitSource, setCostPerUnitSource] = useState("")
    const [commissionPct, setCommissionPct] = useState("5")
    const [commissionFixed, setCommissionFixed] = useState("0")
    const [vatPct, setVatPct] = useState("7")
    const [lastMileCarrier, setLastMileCarrier] = useState<LastMileCarrier>("avg")
    const [lastMileCustomPerUnit, setLastMileCustomPerUnit] = useState("")
    const [sellingPriceTHB, setSellingPriceTHB] = useState("")
    const [targetMarginPct, setTargetMarginPct] = useState("30")
    const [quickCalcMode, setQuickCalcMode] = useState(false)

    const addExtraCharge = () => setExtraCharges((prev) => [...prev, newCharge()])
    const removeExtraCharge = (id: string) =>
        setExtraCharges((prev) => prev.filter((c) => c.id !== id))
    const updateExtraCharge = (id: string, patch: Partial<ExtraCharge>) =>
        setExtraCharges((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))

    const applyPreset = (preset: ExtraCharge[]) => {
        setUseBaseRate(false)
        setExtraCharges(preset.map((c) => newCharge(c)))
    }

    const updateItem = (id: string, patch: Partial<Item>) => {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
    }

    const addItem = () => setItems((prev) => [...prev, newItem()])
    const removeItem = (id: string) =>
        setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it.id !== id)))

    const currencySymbol: Record<Currency, string> = { THB: "฿", RMB: "¥", USD: "$" }
    const rateToTHB: Record<Currency, number> = {
        THB: 1,
        RMB: n(rmbRate) || 1,
        USD: n(usdRate) || 1,
    }

    const toDisplay = (thb: number) => thb / rateToTHB[displayCurrency]

    const calculation = useMemo(() => {
        const divisor = n(volumetricDivisor) || 167

        const rows = items.map((it) => {
            const qty = Math.max(1, n(it.cartons) || 1)
            const cbmPerCarton =
                it.mode === "dimensions"
                    ? (n(it.width) * n(it.length) * n(it.height)) / 1_000_000
                    : n(it.directCBM) / qty // treat directCBM as total CBM, split per carton
            const totalCBM =
                it.mode === "dimensions" ? cbmPerCarton * qty : n(it.directCBM)

            const totalWeight =
                it.mode === "dimensions"
                    ? n(it.weightPerCarton) * qty
                    : n(it.directWeight)

            const volumetricWeight = totalCBM * divisor
            const chargeableWeight = Math.max(totalWeight, volumetricWeight)

            const r = rates[transport][it.category]
            const byCBM = useBaseRate ? totalCBM * r.perCBM : 0
            const byKg = useBaseRate ? totalWeight * r.perKg : 0
            const baseFreightTHB = useBaseRate ? Math.max(byCBM, byKg) : 0
            const driver: "CBM" | "KG" = byCBM >= byKg ? "CBM" : "KG"

            const units = n(it.units)

            return {
                id: it.id,
                name: it.name || "(no name)",
                category: it.category,
                mode: it.mode,
                qty,
                totalCBM,
                totalWeight,
                volumetricWeight,
                chargeableWeight,
                byCBM,
                byKg,
                baseFreightTHB,
                driver,
                units,
                rate: r,
            }
        })

        const totalCBM = rows.reduce((s, r) => s + r.totalCBM, 0)
        const totalWeight = rows.reduce((s, r) => s + r.totalWeight, 0)
        const totalCartons = rows.reduce((s, r) => s + r.qty, 0)
        const totalVolumetric = rows.reduce((s, r) => s + r.volumetricWeight, 0)
        const totalBaseFreightTHB = rows.reduce((s, r) => s + r.baseFreightTHB, 0)

        // Extra charges — computed once per shipment (not per item row)
        const extraLines = extraCharges.map((c) => {
            const amount = n(c.amount)
            let total = 0
            switch (c.basis) {
                case "per_cbm":
                    total = amount * totalCBM
                    break
                case "per_kg":
                    total = amount * totalWeight
                    break
                case "per_shipment":
                    total = amount
                    break
                case "per_carton":
                    total = amount * totalCartons
                    break
            }
            return {
                id: c.id,
                label: c.label || "(no label)",
                basis: c.basis,
                rate: amount,
                totalTHB: total,
            }
        })
        const totalExtraTHB = extraLines.reduce((s, l) => s + l.totalTHB, 0)
        const totalShippingTHB = totalBaseFreightTHB + totalExtraTHB

        const totalUnits = rows.reduce((s, r) => s + r.units, 0)
        const costPerUnitTHB = totalUnits > 0 ? totalShippingTHB / totalUnits : 0

        const productValue = n(productValueTHB)
        const dutyAmount = ((productValue + totalShippingTHB) * n(taxDutyPct)) / 100
        const landedCostTHB = productValue + totalShippingTHB + dutyAmount

        return {
            rows,
            totalCBM,
            totalWeight,
            totalCartons,
            totalVolumetric,
            totalBaseFreightTHB,
            extraLines,
            totalExtraTHB,
            totalShippingTHB,
            totalUnits,
            costPerUnitTHB,
            productValue,
            dutyAmount,
            landedCostTHB,
        }
    }, [
        items,
        transport,
        volumetricDivisor,
        productValueTHB,
        taxDutyPct,
        rates,
        extraCharges,
        useBaseRate,
    ])

    const pricing = useMemo(() => {
        const divisor = n(volumetricDivisor) || 167
        const totalUnits = calculation.totalUnits
        const costSourceRate = rateToTHB[costCurrency]
        const costPerUnitTHB = n(costPerUnitSource) * costSourceRate

        // Commission (% on cost) + fixed
        const commissionAmount =
            (costPerUnitTHB * n(commissionPct)) / 100 + n(commissionFixed)

        // VAT applied on (cost + commission)
        const vatBase = costPerUnitTHB + commissionAmount
        const vatAmount = (vatBase * n(vatPct)) / 100

        // Sea freight per unit (from shipping calc)
        const seaFreightPerUnit =
            totalUnits > 0 ? calculation.totalShippingTHB / totalUnits : 0

        // Last-mile per unit: compute chargeable weight per unit then lookup
        const cbmPerUnit = totalUnits > 0 ? calculation.totalCBM / totalUnits : 0
        const actualWeightPerUnit =
            totalUnits > 0 ? calculation.totalWeight / totalUnits : 0
        const volumetricWeightPerUnit = cbmPerUnit * divisor
        const chargeableWeightPerUnit = Math.max(
            actualWeightPerUnit,
            volumetricWeightPerUnit
        )

        let lastMilePerUnit = 0
        if (lastMileCarrier === "custom") {
            lastMilePerUnit = n(lastMileCustomPerUnit)
        } else {
            lastMilePerUnit = lookupLastMile(
                chargeableWeightPerUnit,
                LAST_MILE_RATES[lastMileCarrier]
            )
        }

        const freightPortion = quickCalcMode
            ? 0
            : seaFreightPerUnit + lastMilePerUnit

        const totalCostPerUnit =
            costPerUnitTHB + commissionAmount + vatAmount + freightPortion

        // Pricing sim
        const price = n(sellingPriceTHB)
        const profit = price - totalCostPerUnit
        const marginPct = price > 0 ? (profit / price) * 100 : 0
        const markupPct = totalCostPerUnit > 0 ? (profit / totalCostPerUnit) * 100 : 0

        // Suggested price at target margin: price = cost / (1 - margin%)
        const targetMargin = n(targetMarginPct)
        const suggestedPrice =
            targetMargin > 0 && targetMargin < 100
                ? totalCostPerUnit / (1 - targetMargin / 100)
                : totalCostPerUnit

        return {
            costPerUnitTHB,
            commissionAmount,
            vatAmount,
            seaFreightPerUnit,
            lastMilePerUnit,
            chargeableWeightPerUnit,
            cbmPerUnit,
            totalCostPerUnit,
            price,
            profit,
            marginPct,
            markupPct,
            suggestedPrice,
            totalUnits,
        }
    }, [
        calculation,
        costCurrency,
        costPerUnitSource,
        commissionPct,
        commissionFixed,
        vatPct,
        lastMileCarrier,
        lastMileCustomPerUnit,
        sellingPriceTHB,
        targetMarginPct,
        quickCalcMode,
        volumetricDivisor,
        rmbRate,
        usdRate,
    ])

    const buildSummaryText = () => {
        const sym = currencySymbol[displayCurrency]
        const lines: string[] = []
        lines.push("SHIPPING CALCULATION SUMMARY")
        lines.push("=".repeat(40))
        lines.push(`Transport: ${TRANSPORT_INFO[transport].label}`)
        lines.push(
            `Display Currency: ${displayCurrency} (1 RMB = ${rmbRate} THB, 1 USD = ${usdRate} THB)`
        )
        lines.push("")
        calculation.rows.forEach((r, i) => {
            lines.push(`[${i + 1}] ${r.name}  (${CATEGORY_INFO[r.category].label})`)
            lines.push(
                `    Cartons: ${r.qty}  |  CBM: ${fmt(r.totalCBM, 4)}  |  Weight: ${fmt(r.totalWeight)} kg`
            )
            lines.push(`    Volumetric Weight: ${fmt(r.volumetricWeight)} kg`)
            if (useBaseRate) {
                lines.push(
                    `    Base Freight: ${sym}${fmt(toDisplay(r.baseFreightTHB))}  (charged by ${r.driver})`
                )
            }
            lines.push("")
        })
        lines.push("-".repeat(40))
        lines.push(`Total CBM:              ${fmt(calculation.totalCBM, 4)}`)
        lines.push(`Total Actual Weight:    ${fmt(calculation.totalWeight)} kg`)
        lines.push(`Total Volumetric Wt:    ${fmt(calculation.totalVolumetric)} kg`)
        lines.push(`Total Cartons:          ${calculation.totalCartons}`)
        lines.push("")
        lines.push("COST BREAKDOWN")
        lines.push("-".repeat(40))
        if (useBaseRate && calculation.totalBaseFreightTHB > 0) {
            lines.push(
                `Base Freight:           ${sym}${fmt(toDisplay(calculation.totalBaseFreightTHB))}`
            )
        }
        calculation.extraLines.forEach((l) => {
            const basisNote = `${fmt(l.rate)} THB ${CHARGE_BASIS_LABEL[l.basis]}`
            lines.push(
                `${(l.label + ":").padEnd(24)}${sym}${fmt(toDisplay(l.totalTHB))}   (${basisNote})`
            )
        })
        lines.push(
            `TOTAL SHIPPING:         ${sym}${fmt(toDisplay(calculation.totalShippingTHB))}`
        )
        if (calculation.totalUnits > 0) {
            lines.push(
                `Per Unit (${calculation.totalUnits} units):   ${sym}${fmt(toDisplay(calculation.costPerUnitTHB))} / unit`
            )
        }
        // Pricing section
        if (n(costPerUnitSource) > 0) {
            lines.push("")
            lines.push("COST & PRICING (per unit)")
            lines.push("-".repeat(40))
            lines.push(
                `Product Cost:           ${sym}${fmt(toDisplay(pricing.costPerUnitTHB))}  (${costPerUnitSource} ${costCurrency})`
            )
            lines.push(
                `Commission:             ${sym}${fmt(toDisplay(pricing.commissionAmount))}  (${commissionPct}% + ฿${commissionFixed})`
            )
            lines.push(
                `VAT ${vatPct}%:                 ${sym}${fmt(toDisplay(pricing.vatAmount))}`
            )
            if (!quickCalcMode) {
                lines.push(
                    `Sea Freight:            ${sym}${fmt(toDisplay(pricing.seaFreightPerUnit))}`
                )
                lines.push(
                    `Last-mile (${LAST_MILE_LABEL[lastMileCarrier]}): ${sym}${fmt(toDisplay(pricing.lastMilePerUnit))}`
                )
            } else {
                lines.push(`[Quick Calc mode — Freight excluded]`)
            }
            lines.push(
                `TOTAL COST / UNIT:      ${sym}${fmt(toDisplay(pricing.totalCostPerUnit))}`
            )
            if (pricing.price > 0) {
                lines.push("")
                lines.push(
                    `Selling Price:          ${sym}${fmt(toDisplay(pricing.price))}`
                )
                lines.push(
                    `Profit / Unit:          ${sym}${fmt(toDisplay(pricing.profit))}`
                )
                lines.push(
                    `Margin:                 ${fmt(pricing.marginPct)}%`
                )
                lines.push(
                    `Markup:                 ${fmt(pricing.markupPct)}%`
                )
                if (pricing.totalUnits > 0) {
                    lines.push(
                        `Total Profit (${pricing.totalUnits} units): ${sym}${fmt(toDisplay(pricing.profit * pricing.totalUnits))}`
                    )
                }
            }
            lines.push(
                `Suggested @ ${targetMarginPct}% margin: ${sym}${fmt(toDisplay(pricing.suggestedPrice))}`
            )
        }
        if (calculation.productValue > 0) {
            lines.push(
                `Product Value:          ${sym}${fmt(toDisplay(calculation.productValue))}`
            )
            lines.push(
                `Tax/Duty (${taxDutyPct}%):        ${sym}${fmt(toDisplay(calculation.dutyAmount))}`
            )
            lines.push(
                `LANDED COST:            ${sym}${fmt(toDisplay(calculation.landedCostTHB))}`
            )
        }
        if (notes.trim()) {
            lines.push("")
            lines.push("Notes:")
            lines.push(notes)
        }
        return lines.join("\n")
    }

    const copySummary = async () => {
        try {
            await navigator.clipboard.writeText(buildSummaryText())
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
        } catch {
            // ignore
        }
    }

    const sym = currencySymbol[displayCurrency]

    return (
        <div className="flex flex-col gap-4 w-full py-2 text-foreground">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Calculator className="h-7 w-7 text-primary" />
                    Shipping Calculator (China → Thailand)
                </h1>
                <p className="text-muted-foreground mt-1">
                    คำนวณ CBM, น้ำหนัก, และค่าขนส่งสินค้าจากจีนทั้งทางเรือ / รถ / Express
                </p>
            </div>

            {/* Transport Mode */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">1. เลือกประเภทการขนส่ง</CardTitle>
                    <CardDescription>Transport mode</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {(Object.keys(TRANSPORT_INFO) as TransportMode[]).map((t) => {
                            const info = TRANSPORT_INFO[t]
                            const active = transport === t
                            const Icon = info.Icon
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTransport(t)}
                                    className={`text-left border rounded-lg p-4 transition-all ${
                                        active
                                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                            : "border-border hover:bg-muted/40"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon
                                            className={`h-5 w-5 ${
                                                active ? "text-primary" : "text-muted-foreground"
                                            }`}
                                        />
                                        <span className="font-semibold">{info.label}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">{info.desc}</div>
                                </button>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Items */}
            <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                        <CardTitle className="text-base">2. รายการสินค้า</CardTitle>
                        <CardDescription>เพิ่มได้หลายรายการ · กรอกได้ทั้งแบบขนาดกล่องหรือใส่ CBM ตรงๆ</CardDescription>
                    </div>
                    <Button onClick={addItem} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {items.map((it, idx) => {
                        const row = calculation.rows[idx]
                        return (
                            <div
                                key={it.id}
                                className="border rounded-lg p-4 space-y-4 bg-muted/10"
                            >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">#{idx + 1}</Badge>
                                        <Input
                                            placeholder="Product name / SKU (optional)"
                                            value={it.name}
                                            onChange={(e) =>
                                                updateItem(it.id, { name: e.target.value })
                                            }
                                            className="w-64"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="inline-flex rounded-md border bg-background p-0.5">
                                            <button
                                                type="button"
                                                onClick={() => updateItem(it.id, { mode: "dimensions" })}
                                                className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                                                    it.mode === "dimensions"
                                                        ? "bg-primary text-primary-foreground"
                                                        : "text-muted-foreground"
                                                }`}
                                            >
                                                <Ruler className="h-3 w-3" /> Dimensions
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateItem(it.id, { mode: "direct" })}
                                                className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                                                    it.mode === "direct"
                                                        ? "bg-primary text-primary-foreground"
                                                        : "text-muted-foreground"
                                                }`}
                                            >
                                                <Box className="h-3 w-3" /> Direct CBM
                                            </button>
                                        </div>
                                        {items.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeItem(it.id)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                    <div className="space-y-1 md:col-span-2">
                                        <Label className="text-xs">Category</Label>
                                        <Select
                                            value={it.category}
                                            onValueChange={(v) =>
                                                updateItem(it.id, { category: v as ProductCategory })
                                            }
                                        >
                                            <SelectTrigger className="bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(Object.keys(CATEGORY_INFO) as ProductCategory[]).map(
                                                    (c) => (
                                                        <SelectItem key={c} value={c}>
                                                            <div className="flex flex-col">
                                                                <span>{CATEGORY_INFO[c].label}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {CATEGORY_INFO[c].desc}
                                                                </span>
                                                            </div>
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {it.mode === "dimensions" ? (
                                        <>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Width (cm)</Label>
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={it.width}
                                                    onChange={(e) =>
                                                        updateItem(it.id, { width: e.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Length (cm)</Label>
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={it.length}
                                                    onChange={(e) =>
                                                        updateItem(it.id, { length: e.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Height (cm)</Label>
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={it.height}
                                                    onChange={(e) =>
                                                        updateItem(it.id, { height: e.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Wt/Carton (kg)</Label>
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={it.weightPerCarton}
                                                    onChange={(e) =>
                                                        updateItem(it.id, {
                                                            weightPerCarton: e.target.value,
                                                        })
                                                    }
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-1 md:col-span-2">
                                                <Label className="text-xs">Total CBM</Label>
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    placeholder="e.g. 0.5"
                                                    value={it.directCBM}
                                                    onChange={(e) =>
                                                        updateItem(it.id, { directCBM: e.target.value })
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-1 md:col-span-2">
                                                <Label className="text-xs">Total Weight (kg)</Label>
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    placeholder="e.g. 25"
                                                    value={it.directWeight}
                                                    onChange={(e) =>
                                                        updateItem(it.id, { directWeight: e.target.value })
                                                    }
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="space-y-1">
                                        <Label className="text-xs">
                                            {it.mode === "dimensions" ? "Cartons" : "Cartons (opt.)"}
                                        </Label>
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            value={it.cartons}
                                            onChange={(e) =>
                                                updateItem(it.id, { cartons: e.target.value })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                    <div className="space-y-1 md:col-span-2">
                                        <Label className="text-xs">Units in shipment (opt.)</Label>
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            placeholder="for per-unit cost"
                                            value={it.units}
                                            onChange={(e) =>
                                                updateItem(it.id, { units: e.target.value })
                                            }
                                        />
                                    </div>
                                </div>

                                {/* Row Result */}
                                {row && (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-md bg-background border border-dashed">
                                        <Metric label="CBM" value={fmt(row.totalCBM, 4)} unit="m³" />
                                        <Metric
                                            label="Actual Wt."
                                            value={fmt(row.totalWeight)}
                                            unit="kg"
                                        />
                                        <Metric
                                            label="Volumetric Wt."
                                            value={fmt(row.volumetricWeight)}
                                            unit="kg"
                                        />
                                        {useBaseRate ? (
                                            <Metric
                                                label={`Base Freight (${row.driver})`}
                                                value={`${sym}${fmt(toDisplay(row.baseFreightTHB))}`}
                                                unit={displayCurrency}
                                                highlight
                                            />
                                        ) : (
                                            <Metric
                                                label="Base Freight"
                                                value="(disabled)"
                                                unit="using extra only"
                                            />
                                        )}
                                        <Metric
                                            label="Cartons"
                                            value={String(row.qty)}
                                            unit={row.units > 0 ? `${row.units} units` : ""}
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Additional Charges */}
            <Card>
                <CardHeader className="space-y-3">
                    <div className="flex flex-row items-start justify-between gap-2 flex-wrap">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Receipt className="h-4 w-4" /> 3. ค่าขนส่งและค่าใช้จ่ายเพิ่มเติม
                            </CardTitle>
                            <CardDescription>
                                เช่น O/F, Local Charge, D/O, Customs, Handling — เพิ่มได้ไม่จำกัด
                            </CardDescription>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyPreset(LCL_SEA_PRESET)}
                            >
                                <Sparkles className="h-3.5 w-3.5 mr-1" /> LCL Sea Preset
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyPreset(LAND_PRESET)}
                            >
                                <Sparkles className="h-3.5 w-3.5 mr-1" /> Land Preset
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => applyPreset(EXPRESS_PRESET)}
                            >
                                <Sparkles className="h-3.5 w-3.5 mr-1" /> Express Preset
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <input
                            id="useBaseRate"
                            type="checkbox"
                            checked={useBaseRate}
                            onChange={(e) => setUseBaseRate(e.target.checked)}
                            className="h-4 w-4 rounded border-input"
                        />
                        <label htmlFor="useBaseRate" className="cursor-pointer">
                            คิดค่า Base Freight จาก Category (Type A/B/C) — ปิดถ้าคิดเป็น line-item อย่างเดียว
                        </label>
                    </div>
                </CardHeader>
                <CardContent>
                    {extraCharges.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
                            ยังไม่มีรายการ — กด Preset ด้านบน หรือกด "Add Charge" เพื่อเพิ่มเอง
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2 font-medium">Label</th>
                                        <th className="text-right p-2 font-medium w-32">
                                            Amount (THB)
                                        </th>
                                        <th className="text-left p-2 font-medium w-44">Basis</th>
                                        <th className="text-right p-2 font-medium w-32">
                                            Total (THB)
                                        </th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {extraCharges.map((c, i) => {
                                        const line = calculation.extraLines[i]
                                        return (
                                            <tr key={c.id} className="border-b">
                                                <td className="p-2">
                                                    <Input
                                                        value={c.label}
                                                        placeholder="e.g. Local Charge"
                                                        onChange={(e) =>
                                                            updateExtraCharge(c.id, {
                                                                label: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <Input
                                                        type="number"
                                                        inputMode="decimal"
                                                        className="text-right"
                                                        value={c.amount}
                                                        onChange={(e) =>
                                                            updateExtraCharge(c.id, {
                                                                amount: e.target.value,
                                                            })
                                                        }
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <Select
                                                        value={c.basis}
                                                        onValueChange={(v) =>
                                                            updateExtraCharge(c.id, {
                                                                basis: v as ChargeBasis,
                                                            })
                                                        }
                                                    >
                                                        <SelectTrigger className="bg-background">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(
                                                                Object.keys(
                                                                    CHARGE_BASIS_LABEL
                                                                ) as ChargeBasis[]
                                                            ).map((b) => (
                                                                <SelectItem key={b} value={b}>
                                                                    {CHARGE_BASIS_LABEL[b]}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="p-2 text-right font-medium">
                                                    {line ? fmt(line.totalTHB) : "0.00"}
                                                </td>
                                                <td className="p-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeExtraCharge(c.id)}
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="p-2 text-right font-semibold text-muted-foreground"
                                        >
                                            Additional Charges Subtotal
                                        </td>
                                        <td className="p-2 text-right font-bold">
                                            ฿{fmt(calculation.totalExtraTHB)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    <Button
                        type="button"
                        onClick={addExtraCharge}
                        variant="outline"
                        size="sm"
                        className="mt-3"
                    >
                        <Plus className="h-4 w-4 mr-1" /> Add Charge
                    </Button>
                </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">4. การตั้งค่า (Advanced)</CardTitle>
                    <CardDescription>
                        ตั้งค่าอัตราแลกเปลี่ยน น้ำหนักเชิงปริมาตร และภาษีนำเข้า
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-1">
                        <Label className="text-xs">Display Currency</Label>
                        <Select
                            value={displayCurrency}
                            onValueChange={(v) => setDisplayCurrency(v as Currency)}
                        >
                            <SelectTrigger className="bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="THB">THB (฿)</SelectItem>
                                <SelectItem value="RMB">RMB (¥)</SelectItem>
                                <SelectItem value="USD">USD ($)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs">1 RMB = ? THB</Label>
                        <Input
                            type="number"
                            inputMode="decimal"
                            value={rmbRate}
                            onChange={(e) => setRmbRate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs">1 USD = ? THB</Label>
                        <Input
                            type="number"
                            inputMode="decimal"
                            value={usdRate}
                            onChange={(e) => setUsdRate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs">Volumetric Divisor</Label>
                        <Input
                            type="number"
                            inputMode="decimal"
                            value={volumetricDivisor}
                            onChange={(e) => setVolumetricDivisor(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">
                            มาตรฐาน Sea/Land = 167, Air = 167–200
                        </p>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs flex items-center gap-1">
                            <Coins className="h-3 w-3" /> มูลค่าสินค้า (Product Value) — THB
                        </Label>
                        <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="กรอกเพื่อคำนวณ Landed Cost"
                            value={productValueTHB}
                            onChange={(e) => setProductValueTHB(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs">Tax / Duty (%)</Label>
                        <Input
                            type="number"
                            inputMode="decimal"
                            value={taxDutyPct}
                            onChange={(e) => setTaxDutyPct(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-xs">&nbsp;</Label>
                        <Button
                            type="button"
                            variant={overrideRates ? "default" : "outline"}
                            onClick={() => setOverrideRates((v) => !v)}
                            className="w-full"
                        >
                            {overrideRates ? "Lock rates" : "Edit rates"}
                        </Button>
                    </div>

                    <div className="md:col-span-4 space-y-1">
                        <Label className="text-xs">Notes</Label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ซัพพลายเออร์, PO, เงื่อนไขเพิ่มเติม..."
                            className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Rate Editor */}
            {overrideRates && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Rate Table (THB) — editable session only</CardTitle>
                        <CardDescription>
                            Editing does not persist. All values are in THB.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-2">Transport</th>
                                        <th className="text-left p-2">Category</th>
                                        <th className="text-right p-2">THB / CBM</th>
                                        <th className="text-right p-2">THB / Kg</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Object.keys(rates) as TransportMode[]).flatMap((t) =>
                                        (Object.keys(rates[t]) as ProductCategory[]).map((c) => (
                                            <tr key={`${t}-${c}`} className="border-b">
                                                <td className="p-2">{TRANSPORT_INFO[t].label}</td>
                                                <td className="p-2">{CATEGORY_INFO[c].label}</td>
                                                <td className="p-2">
                                                    <Input
                                                        className="text-right"
                                                        type="number"
                                                        value={rates[t][c].perCBM}
                                                        onChange={(e) =>
                                                            setRates((prev) => ({
                                                                ...prev,
                                                                [t]: {
                                                                    ...prev[t],
                                                                    [c]: {
                                                                        ...prev[t][c],
                                                                        perCBM: n(e.target.value),
                                                                    },
                                                                },
                                                            }))
                                                        }
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <Input
                                                        className="text-right"
                                                        type="number"
                                                        value={rates[t][c].perKg}
                                                        onChange={(e) =>
                                                            setRates((prev) => ({
                                                                ...prev,
                                                                [t]: {
                                                                    ...prev[t],
                                                                    [c]: {
                                                                        ...prev[t][c],
                                                                        perKg: n(e.target.value),
                                                                    },
                                                                },
                                                            }))
                                                        }
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Product Cost & Pricing */}
            <Card>
                <CardHeader className="space-y-3">
                    <div className="flex flex-row items-start justify-between gap-2 flex-wrap">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Wallet className="h-4 w-4" /> 5. ต้นทุนสินค้า & ราคาขาย
                            </CardTitle>
                            <CardDescription>
                                Product Cost, Commission, VAT, Shipping → คำนวณราคาขายและกำไร
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 text-sm rounded-md border px-3 py-2 bg-amber-50">
                            <input
                                id="quickCalc"
                                type="checkbox"
                                checked={quickCalcMode}
                                onChange={(e) => setQuickCalcMode(e.target.checked)}
                                className="h-4 w-4"
                            />
                            <label htmlFor="quickCalc" className="cursor-pointer flex items-center gap-1">
                                <Bolt className="h-3.5 w-3.5 text-amber-600" />
                                Quick Calc (คิดแค่ Commission + VAT)
                            </label>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Inputs */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-1">
                            <Label className="text-xs">Cost Currency</Label>
                            <Select
                                value={costCurrency}
                                onValueChange={(v) => setCostCurrency(v as Currency)}
                            >
                                <SelectTrigger className="bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="RMB">RMB (¥)</SelectItem>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="THB">THB (฿)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <Label className="text-xs flex items-center gap-1">
                                <Tag className="h-3 w-3" /> ต้นทุนต่อหน่วย ({costCurrency})
                            </Label>
                            <Input
                                type="number"
                                inputMode="decimal"
                                placeholder={`เช่น ${costCurrency === "RMB" ? "18" : costCurrency === "USD" ? "2.5" : "90"}`}
                                value={costPerUnitSource}
                                onChange={(e) => setCostPerUnitSource(e.target.value)}
                            />
                            {n(costPerUnitSource) > 0 && costCurrency !== "THB" && (
                                <p className="text-[11px] text-muted-foreground">
                                    = ฿{fmt(pricing.costPerUnitTHB)} / unit (rate 1 {costCurrency} = {costCurrency === "RMB" ? rmbRate : usdRate} THB)
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Units (จาก Items)</Label>
                            <div className="h-10 px-3 py-2 rounded-md border bg-muted/30 text-sm flex items-center">
                                {pricing.totalUnits > 0 ? (
                                    `${pricing.totalUnits.toLocaleString()} units`
                                ) : (
                                    <span className="text-muted-foreground text-xs">
                                        กรอก Units ใน Items
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                                <Percent className="h-3 w-3" /> Commission %
                            </Label>
                            <Input
                                type="number"
                                inputMode="decimal"
                                value={commissionPct}
                                onChange={(e) => setCommissionPct(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Commission Fixed (THB/unit)</Label>
                            <Input
                                type="number"
                                inputMode="decimal"
                                value={commissionFixed}
                                onChange={(e) => setCommissionFixed(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">VAT %</Label>
                            <Input
                                type="number"
                                inputMode="decimal"
                                value={vatPct}
                                onChange={(e) => setVatPct(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">คงที่ 7% (แก้ได้)</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Last-mile Carrier</Label>
                            <Select
                                value={lastMileCarrier}
                                onValueChange={(v) => setLastMileCarrier(v as LastMileCarrier)}
                                disabled={quickCalcMode}
                            >
                                <SelectTrigger className="bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(LAST_MILE_LABEL) as LastMileCarrier[]).map(
                                        (k) => (
                                            <SelectItem key={k} value={k}>
                                                {LAST_MILE_LABEL[k]}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {lastMileCarrier === "custom" && !quickCalcMode && (
                            <div className="space-y-1 md:col-span-4">
                                <Label className="text-xs">Custom Last-mile (THB/unit)</Label>
                                <Input
                                    type="number"
                                    inputMode="decimal"
                                    value={lastMileCustomPerUnit}
                                    onChange={(e) => setLastMileCustomPerUnit(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Rate reference table for last-mile */}
                    {!quickCalcMode && lastMileCarrier !== "custom" && (
                        <div className="rounded-md border bg-muted/10 p-3">
                            <div className="text-xs font-medium mb-2 text-muted-foreground">
                                อัตรา Last-mile ที่ใช้ ({LAST_MILE_LABEL[lastMileCarrier]})
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                                {LAST_MILE_RATES[lastMileCarrier].map((t) => {
                                    const isActive =
                                        pricing.chargeableWeightPerUnit > 0 &&
                                        pricing.chargeableWeightPerUnit <= t.maxKg &&
                                        (LAST_MILE_RATES[lastMileCarrier].indexOf(t) === 0 ||
                                            pricing.chargeableWeightPerUnit >
                                                LAST_MILE_RATES[lastMileCarrier][
                                                    LAST_MILE_RATES[lastMileCarrier].indexOf(t) - 1
                                                ].maxKg)
                                    return (
                                        <span
                                            key={t.maxKg}
                                            className={`rounded px-2 py-1 border ${
                                                isActive
                                                    ? "bg-primary/10 border-primary text-primary font-semibold"
                                                    : "bg-background border-border"
                                            }`}
                                        >
                                            {t.maxKg === Infinity
                                                ? "> 20kg"
                                                : `≤ ${t.maxKg}kg`}{" "}
                                            · ฿{t.price}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Cost Breakdown per unit */}
                    {n(costPerUnitSource) > 0 && (
                        <div className="rounded-md border bg-muted/10">
                            <div className="px-4 py-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                                <span>Cost Breakdown (per unit)</span>
                                {quickCalcMode && (
                                    <Badge variant="secondary" className="text-[10px]">
                                        Quick mode · ไม่รวม Freight
                                    </Badge>
                                )}
                            </div>
                            <div className="divide-y text-sm">
                                <CostRow label="Product Cost" note={`${costPerUnitSource || 0} ${costCurrency}`} amount={pricing.costPerUnitTHB} sym={sym} toDisplay={toDisplay} />
                                <CostRow
                                    label="Commission"
                                    note={`${commissionPct}% + ฿${commissionFixed} fixed`}
                                    amount={pricing.commissionAmount}
                                    sym={sym}
                                    toDisplay={toDisplay}
                                />
                                <CostRow
                                    label={`VAT ${vatPct}%`}
                                    note="on (cost + commission)"
                                    amount={pricing.vatAmount}
                                    sym={sym}
                                    toDisplay={toDisplay}
                                />
                                {!quickCalcMode && (
                                    <>
                                        <CostRow
                                            label="Sea Freight"
                                            note={`share of total shipping / ${pricing.totalUnits || 0} units`}
                                            amount={pricing.seaFreightPerUnit}
                                            sym={sym}
                                            toDisplay={toDisplay}
                                        />
                                        <CostRow
                                            label="Last-mile Delivery"
                                            note={`${LAST_MILE_LABEL[lastMileCarrier]} · chargeable wt ${fmt(pricing.chargeableWeightPerUnit)} kg/unit`}
                                            amount={pricing.lastMilePerUnit}
                                            sym={sym}
                                            toDisplay={toDisplay}
                                        />
                                    </>
                                )}
                                <div className="flex justify-between px-4 py-3 bg-primary/5">
                                    <span className="font-semibold">Total Cost / Unit</span>
                                    <span className="font-bold text-primary">
                                        {sym}
                                        {fmt(toDisplay(pricing.totalCostPerUnit))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pricing Simulation */}
                    {n(costPerUnitSource) > 0 && (
                        <div className="rounded-lg border p-4 bg-gradient-to-br from-emerald-50 to-background">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                                <h3 className="font-semibold">Pricing Simulation</h3>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">ราคาขาย (THB/unit)</Label>
                                        <Input
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="e.g. 199"
                                            value={sellingPriceTHB}
                                            onChange={(e) => setSellingPriceTHB(e.target.value)}
                                            className="text-lg font-semibold"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <ProfitTile
                                            label="Profit / Unit"
                                            value={
                                                pricing.price > 0
                                                    ? `${sym}${fmt(toDisplay(pricing.profit))}`
                                                    : "—"
                                            }
                                            positive={pricing.profit > 0}
                                        />
                                        <ProfitTile
                                            label="Margin"
                                            value={
                                                pricing.price > 0
                                                    ? `${fmt(pricing.marginPct)}%`
                                                    : "—"
                                            }
                                            positive={pricing.marginPct > 0}
                                        />
                                        <ProfitTile
                                            label="Markup"
                                            value={
                                                pricing.price > 0
                                                    ? `${fmt(pricing.markupPct)}%`
                                                    : "—"
                                            }
                                            positive={pricing.markupPct > 0}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">ต้องการ Margin กี่ %</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                value={targetMarginPct}
                                                onChange={(e) => setTargetMarginPct(e.target.value)}
                                                className="w-24"
                                            />
                                            <div className="flex-1 h-10 rounded-md border bg-background px-3 flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">
                                                    แนะนำราคาขาย
                                                </span>
                                                <span className="font-bold text-emerald-700">
                                                    {sym}
                                                    {fmt(toDisplay(pricing.suggestedPrice))}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1 pt-1">
                                        <div>
                                            ต้นทุนต่อหน่วย: {sym}
                                            {fmt(toDisplay(pricing.totalCostPerUnit))}
                                        </div>
                                        <div>
                                            Break-even: {sym}
                                            {fmt(toDisplay(pricing.totalCostPerUnit))} (ราคาขาย = ต้นทุน)
                                        </div>
                                        {pricing.totalUnits > 0 && (
                                            <div>
                                                กำไรรวม {pricing.totalUnits} units: {sym}
                                                {fmt(toDisplay(pricing.profit * pricing.totalUnits))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Summary */}
            <Card className="border-primary/30 shadow-md">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            สรุปผลการคำนวณ
                        </CardTitle>
                        <CardDescription>
                            {TRANSPORT_INFO[transport].label} ·{" "}
                            {items.length} item{items.length > 1 ? "s" : ""}
                        </CardDescription>
                    </div>
                    <Button onClick={copySummary} variant="outline">
                        {copied ? (
                            <>
                                <Check className="h-4 w-4 mr-1 text-green-600" /> Copied
                            </>
                        ) : (
                            <>
                                <Copy className="h-4 w-4 mr-1" /> Copy Summary
                            </>
                        )}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <SummaryTile label="Total CBM" value={`${fmt(calculation.totalCBM, 4)} m³`} />
                        <SummaryTile
                            label="Actual Weight"
                            value={`${fmt(calculation.totalWeight)} kg`}
                        />
                        <SummaryTile
                            label="Volumetric Wt."
                            value={`${fmt(calculation.totalVolumetric)} kg`}
                        />
                        <SummaryTile
                            label="Total Shipping"
                            value={`${sym}${fmt(toDisplay(calculation.totalShippingTHB))}`}
                            highlight
                        />
                    </div>

                    {/* Cost Breakdown Line Items */}
                    <div className="rounded-md border bg-muted/10">
                        <div className="px-4 py-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Cost Breakdown
                        </div>
                        <div className="divide-y">
                            {useBaseRate && calculation.totalBaseFreightTHB > 0 && (
                                <div className="flex justify-between px-4 py-2 text-sm">
                                    <span>
                                        Base Freight{" "}
                                        <span className="text-muted-foreground">
                                            (max CBM × rate vs Kg × rate)
                                        </span>
                                    </span>
                                    <span className="font-medium">
                                        {sym}
                                        {fmt(toDisplay(calculation.totalBaseFreightTHB))}
                                    </span>
                                </div>
                            )}
                            {calculation.extraLines.map((l) => (
                                <div
                                    key={l.id}
                                    className="flex justify-between px-4 py-2 text-sm"
                                >
                                    <span>
                                        {l.label}{" "}
                                        <span className="text-muted-foreground">
                                            ({fmt(l.rate)} THB {CHARGE_BASIS_LABEL[l.basis]})
                                        </span>
                                    </span>
                                    <span className="font-medium">
                                        {sym}
                                        {fmt(toDisplay(l.totalTHB))}
                                    </span>
                                </div>
                            ))}
                            <div className="flex justify-between px-4 py-2 text-sm bg-primary/5">
                                <span className="font-semibold">Total Shipping</span>
                                <span className="font-bold text-primary">
                                    {sym}
                                    {fmt(toDisplay(calculation.totalShippingTHB))}
                                </span>
                            </div>
                            {calculation.totalUnits > 0 && (
                                <div className="flex justify-between px-4 py-2 text-sm">
                                    <span className="text-muted-foreground">
                                        Per Unit ({calculation.totalUnits} units)
                                    </span>
                                    <span className="font-medium">
                                        {sym}
                                        {fmt(toDisplay(calculation.costPerUnitTHB))} / unit
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {calculation.productValue > 0 && (
                        <>
                            <Separator />
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <SummaryTile
                                    label="Product Value"
                                    value={`${sym}${fmt(toDisplay(calculation.productValue))}`}
                                />
                                <SummaryTile
                                    label={`Tax/Duty (${taxDutyPct}%)`}
                                    value={`${sym}${fmt(toDisplay(calculation.dutyAmount))}`}
                                />
                                <SummaryTile
                                    label="Shipping"
                                    value={`${sym}${fmt(toDisplay(calculation.totalShippingTHB))}`}
                                />
                                <SummaryTile
                                    label="Landed Cost"
                                    value={`${sym}${fmt(toDisplay(calculation.landedCostTHB))}`}
                                    highlight
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground text-center pt-2 pb-6">
                * สูตรคิดค่าขนส่ง: <b>max(CBM × rate, Kg × rate)</b> · ค่าตั้งต้นเป็นค่ากลางของ Freight Forwarder ทั่วไป ควรปรับตามสัญญาจริงของบริษัท
            </div>
        </div>
    )
}

function Metric({
    label,
    value,
    unit,
    highlight,
}: {
    label: string
    value: string
    unit?: string
    highlight?: boolean
}) {
    return (
        <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
            </span>
            <span
                className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}
            >
                {value}{" "}
                {unit && (
                    <span className="text-[10px] font-normal text-muted-foreground">{unit}</span>
                )}
            </span>
        </div>
    )
}

function CostRow({
    label,
    note,
    amount,
    sym,
    toDisplay,
}: {
    label: string
    note?: string
    amount: number
    sym: string
    toDisplay: (thb: number) => number
}) {
    return (
        <div className="flex justify-between px-4 py-2">
            <span>
                {label}
                {note && (
                    <span className="text-xs text-muted-foreground ml-1">({note})</span>
                )}
            </span>
            <span className="font-medium">
                {sym}
                {toDisplay(amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })}
            </span>
        </div>
    )
}

function ProfitTile({
    label,
    value,
    positive,
}: {
    label: string
    value: string
    positive: boolean
}) {
    return (
        <div
            className={`rounded-md border p-2 text-center ${
                positive
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-rose-50 border-rose-200"
            }`}
        >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
            </div>
            <div
                className={`text-sm font-bold ${
                    positive ? "text-emerald-700" : "text-rose-700"
                }`}
            >
                {value}
            </div>
        </div>
    )
}

function SummaryTile({
    label,
    value,
    highlight,
}: {
    label: string
    value: string
    highlight?: boolean
}) {
    return (
        <div
            className={`rounded-lg p-4 border ${
                highlight ? "bg-primary/5 border-primary/30" : "bg-muted/20"
            }`}
        >
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div
                className={`text-xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}
            >
                {value}
            </div>
        </div>
    )
}
