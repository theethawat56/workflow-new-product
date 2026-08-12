import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { fetchSheet } from "../src/lib/workspace/data-source"
import { readFileSync } from "fs"

async function main() {
    const kol = await fetchSheet("kol")
    const apiRows = JSON.parse(readFileSync("/tmp/dataslot_kol_sheet_rows.json", "utf8")) as Record<
        string,
        string | number
    >[]

    console.log("=== CURRENT SHEET vs DATASLOT API ===")
    console.log(`Sheet rows: ${kol.length}`)
    console.log(`API rows:   ${apiRows.length}`)
    console.log(`Delta:      +${apiRows.length - kol.length}`)

    const sheetTasks = new Set(kol.map((r) => String(r.taskNumber || "").trim()).filter(Boolean))
    const apiTasks = new Set(apiRows.map((r) => String(r.taskNumber || "").trim()).filter(Boolean))
    const onlyApi = [...apiTasks].filter((t) => !sheetTasks.has(t))
    const onlySheet = [...sheetTasks].filter((t) => !apiTasks.has(t))
    console.log(`\nBy taskNumber:`)
    console.log(`  in sheet: ${sheetTasks.size}`)
    console.log(`  in API:   ${apiTasks.size}`)
    console.log(`  only in API (new): ${onlyApi.length}`)
    console.log(`  only in sheet (removed from API): ${onlySheet.length}`)
    if (onlyApi.length) console.log(`  new samples: ${onlyApi.slice(0, 8).join(", ")}`)
    if (onlySheet.length) console.log(`  removed samples: ${onlySheet.slice(0, 8).join(", ")}`)

    const yearCount = (rows: Record<string, unknown>[], key = "Post Date") => {
        const c: Record<string, number> = {}
        for (const r of rows) {
            const d = String(r[key] || "")
            let y = ""
            if (/^\d{4}-\d{2}-\d{2}/.test(d)) y = d.slice(0, 4)
            else if (d.includes("/")) {
                const parts = d.split("/")
                const yr = parts[2] || ""
                y = yr.length === 4 ? yr : `20${yr}`
            }
            if (y) c[y] = (c[y] || 0) + 1
        }
        return c
    }
    console.log("\nPost years — sheet:", yearCount(kol))
    console.log("Post years — API:  ", yearCount(apiRows))

    const topSkus = (rows: Record<string, unknown>[], n = 10) => {
        const c: Record<string, number> = {}
        for (const r of rows) {
            const s = String(r.SKU || "").trim()
            if (s) c[s] = (c[s] || 0) + 1
        }
        return Object.entries(c)
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
    }
    console.log("\nTop SKUs — sheet:", topSkus(kol))
    console.log("Top SKUs — API:  ", topSkus(apiRows))
}

main().catch(console.error)
