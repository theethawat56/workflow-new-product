/**
 * Backtest Stock_AT "Current Stock" end-to-end:
 *  1. Live header / ATB rename
 *  2. Helper qty == direct column value
 *  3. Simulate Next.js unstable_cache JSON round-trip (Map → {} bug)
 *  4. Cohort / sales SKU join after variant indexing
 *
 * Run: npx tsx scripts/backtest-stock-at-current.ts
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { getReadOnlySheetsClient } from "../src/lib/google/sheets-readonly"
import {
    buildStockQtyRecord,
    normalizeStockAtRow,
    stockAtCurrent,
    stockAtSku,
    toStockQtyMap,
} from "../src/lib/stock/stock-at-columns"
import { NEW_2025_SKUS, NEW_2026_SKUS } from "../src/lib/analytics/constants"

async function main() {
    const client = await getReadOnlySheetsClient()
    const spreadsheetId =
        process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID
    if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID")

    const res = await client.spreadsheets.values.get({
        spreadsheetId,
        range: "Stock_AT",
    })
    const values = res.data.values ?? []
    if (values.length < 2) throw new Error("Stock_AT empty")

    const headers = values[0].map((h) => String(h).trim())
    const csIdx = headers.indexOf("Current Stock")
    const atbIdx = headers.indexOf("ATB")
    const skuIdx = headers.indexOf("SKU")

    console.log("=== 1) Header check ===")
    console.log(`  Current Stock @ ${csIdx} (col ${csIdx >= 0 ? String.fromCharCode(65 + csIdx) : "?"})`)
    console.log(`  ATB @ ${atbIdx} | SKU @ ${skuIdx}`)

    if (csIdx < 0) {
        console.error("FAIL: Current Stock column missing")
        process.exit(1)
    }
    if (atbIdx < 0) {
        console.error("FAIL: ATB column missing")
        process.exit(1)
    }

    const rows = values.slice(1).map((row) =>
        Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
    )

    let helperOk = 0
    let helperBad = 0
    let oldSkuHits = 0
    for (const r of rows) {
        if (String(r.SKU ?? "").trim()) oldSkuHits++
        const sku = stockAtSku(r)
        if (!sku) continue
        const direct = Number(String(r["Current Stock"] ?? "").replace(/,/g, "")) || 0
        if (stockAtCurrent(r) === direct) helperOk++
        else helperBad++
    }

    console.log("\n=== 2) Parser ===")
    console.log(`  old r.SKU hits: ${oldSkuHits} (expect 0)`)
    console.log(`  Current Stock helper matches: ${helperOk} ok / ${helperBad} bad`)

    // 3) Cache round-trip simulation
    const record = buildStockQtyRecord(rows)
    const mapBefore = new Map(Object.entries(record))
    const brokenAfterCache = JSON.parse(JSON.stringify(mapBefore)) // Map → {}
    const fixedAfterCache = JSON.parse(JSON.stringify(record)) // Record survives
    const revived = toStockQtyMap(fixedAfterCache)

    console.log("\n=== 3) unstable_cache JSON round-trip ===")
    console.log(`  Map after JSON: keys=${Object.keys(brokenAfterCache).length}  ← BUG if 0`)
    console.log(`  Record after JSON: keys=${Object.keys(fixedAfterCache).length}`)
    console.log(`  revived Map size (with variants): ${revived.size}`)
    console.log(`  sample ATB92049=${revived.get("ATB92049")} ATB092123=${revived.get("ATB092123")}`)
    console.log(`  variant ATB92119=${revived.get("ATB92119")} ATB092119=${revived.get("ATB092119")}`)

    // 4) Cohort join
    const cohort = [...NEW_2025_SKUS, ...NEW_2026_SKUS].map((s) => s.toUpperCase())
    let matched = 0
    const misses: string[] = []
    for (const sku of cohort) {
        if (revived.has(sku)) matched++
        else misses.push(sku)
    }
    console.log("\n=== 4) Cohort join ===")
    console.log(`  matched ${matched}/${cohort.length}`)
    if (misses.length) console.log(`  misses: ${misses.join(", ")}`)

    const normalized = rows.map(normalizeStockAtRow).filter((r) => r.SKU)
    console.log("\n=== 5) /stock page sample ===")
    for (const r of normalized.slice(0, 8)) {
        console.log(
            `  ${r.SKU.padEnd(12)} Current Stock=${String(r["Current Stock"]).padStart(5)}  ${r["Product Name"]}`,
        )
    }

    const pass =
        csIdx >= 0 &&
        atbIdx >= 0 &&
        oldSkuHits === 0 &&
        helperBad === 0 &&
        helperOk > 0 &&
        Object.keys(brokenAfterCache).length === 0 &&
        Object.keys(fixedAfterCache).length > 0 &&
        revived.size > 0 &&
        matched === cohort.length &&
        revived.get("ATB92049") === 300

    if (!pass) {
        console.error("\nFAIL")
        process.exit(1)
    }
    console.log("\nPASS — Current Stock reads correctly; Record cache keeps qty; Map cache would wipe it")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
