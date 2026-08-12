export function fmtThb(n: number, decimals = 0): string {
    return `฿${n.toLocaleString("th-TH", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}`
}

export function fmtNum(n: number, decimals = 0): string {
    return n.toLocaleString("th-TH", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })
}

export function fmtPct(n: number, decimals = 1): string {
    return `${(n * 100).toFixed(decimals)}%`
}

export function fmtPctRaw(n: number, decimals = 1): string {
    return `${n.toFixed(decimals)}%`
}
