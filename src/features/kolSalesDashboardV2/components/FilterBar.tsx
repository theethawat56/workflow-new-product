"use client"

import { DashboardFilters } from "../types"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Filter, Calendar } from "lucide-react"

interface Props {
    filters: DashboardFilters
    onChange: (f: Partial<DashboardFilters>) => void
    options?: {
        products: { sku: string; productName: string }[]
        pics: string[]
        channels: string[]
    }
    loading: boolean
}

export function FilterBar({ filters, onChange, options, loading }: Props) {
    const toggleArray = (key: keyof DashboardFilters, val: string) => {
        const arr = (filters[key] as string[])
        const newArr = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
        onChange({ [key]: newArr })
    }

    return (
        <Card className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">

                {/* 1. Date Range */}
                <div className="space-y-2 lg:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Date Range</Label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                type="date"
                                value={filters.dateRange.from}
                                onChange={e => onChange({ dateRange: { ...filters.dateRange, from: e.target.value } })}
                            />
                        </div>
                        <span className="self-center text-muted-foreground">-</span>
                        <div className="relative flex-1">
                            <Input
                                type="date"
                                value={filters.dateRange.to}
                                onChange={e => onChange({ dateRange: { ...filters.dateRange, to: e.target.value } })}
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Mode Toggle */}
                <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Analysis Mode</Label>
                    <Select
                        value={filters.mode}
                        onValueChange={(v: any) => onChange({ mode: v })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="PERIOD">Period Match (Default)</SelectItem>
                            <SelectItem value="ATTRIBUTION">Attribution (Split)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* 3. Window (Conditional) */}
                {filters.mode === "ATTRIBUTION" && (
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Window (Days)</Label>
                        <Input
                            type="number" min={0} max={30}
                            value={filters.attributionWindow}
                            onChange={e => onChange({ attributionWindow: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                {/* Filters */}
                <FilterDropdown
                    title="Products"
                    selected={filters.selectedSkus}
                    options={options?.products.map(p => ({ label: p.productName, value: p.sku })) || []}
                    onSelect={v => toggleArray("selectedSkus", v)}
                />

                <FilterDropdown
                    title="PICs"
                    selected={filters.selectedPics}
                    options={options?.pics.map(p => ({ label: p, value: p })) || []}
                    onSelect={v => toggleArray("selectedPics", v)}
                />

                <FilterDropdown
                    title="Channels"
                    selected={filters.selectedChannels}
                    options={options?.channels.map(c => ({ label: c, value: c })) || []}
                    onSelect={v => toggleArray("selectedChannels", v)}
                />
            </div>
        </Card>
    )
}

interface FilterDropdownProps {
    title: string
    selected: string[]
    options: { label: string; value: string }[]
    onSelect: (val: string) => void
}

function FilterDropdown({ title, selected, options, onSelect }: FilterDropdownProps) {
    return (
        <div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" size="sm">
                        <span className="truncate">
                            {selected.length > 0 ? `${selected.length} ${title}` : `All ${title}`}
                        </span>
                        <Filter className="h-3 w-3 opacity-50 ml-2" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-2 h-[300px] overflow-y-auto">
                    <div className="space-y-1">
                        {options.map((opt: any) => (
                            <div
                                key={opt.value}
                                className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer text-sm"
                                onClick={() => onSelect(opt.value)}
                            >
                                <div className={`h-4 w-4 border rounded flex items-center justify-center ${selected.includes(opt.value) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                                    {selected.includes(opt.value) && "✓"}
                                </div>
                                <span className="truncate">{opt.label}</span>
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
