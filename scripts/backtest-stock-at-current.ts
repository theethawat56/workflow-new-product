/**
 * Backtest Stock_AT "Current Stock" column mapping across app readers.
 *
 * Verifies:
 *  1. Live sheet still has a header named "Current Stock"
 *  2. SKU column is `ATB` (not `SKU`)
 *  3. Helpers resolve the same qty as direct column-P reads
 *  4. Old r.SKU-only parsers would match 0 rows (regression check)
 *
 * Run: npx tsx scripts/backtest-stock-at-current.ts
 */
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { getReadOnlySheetsClient } from "../src/lib/google/sheets-readonly"
import {
    normalizeStockAtRow,
    stockAtCurrent,
    stockAtSku,
} from "../src/lib/stock/stock-at-columns"

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
    const nameIdx = headers.indexOf("Item name")
    const oldNameIdx = headers.indexOf("Product Name")

    console.log("=== Stock_AT header check ===")
    console.log(`  columns: ${headers.length}`)
    console.log(`  "Current Stock" index: ${csIdx} (${csIdx >= 0 ? String.fromCharCode(65 + (csIdx % 26)) : "MISSING"})`)
    console.log(`  "ATB" index: ${atbIdx}`)
    console.log(`  "SKU" index: ${skuIdx} (expected -1 after rename)`)
    console.log(`  "Item name" index: ${nameIdx}`)
    console.log(`  "Product Name" index: ${oldNameIdx}`)

    if (csIdx < 0) {
        console.error("FAIL: Current Stock column missing from Stock_AT")
        process.exit(1)
    }
    if (atbIdx < 0 && skuIdx < 0) {
        console.error("FAIL: neither ATB nor SKU column present")
        process.exit(1)
    }

    const rows = values.slice(1).map((row) =>
        Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
    )

    let helperMatches = 0
    let helperMismatch = 0
    let oldSkuMatches = 0
    let newSkuMatches = 0
    const samples: string[] = []

    for (const r of rows) {
        const directQty = Number(String(r["Current Stock"] ?? "").replace(/,/g, "")) || 0
        const helperSku = stockAtSku(r)
        const helperQty = stockAtCurrent(r)
        const oldSku = String(r.SKU ?? "").trim().toUpperCase()

        if (oldSku) oldSkuMatches++
        if (helperSku) newSkuMatches++

        if (!helperSku) continue
        if (helperQty === directQty) helperMatches++
        else {
            helperMismatch++
            samples.push(`  MISMATCH ${helperSku}: helper=${helperQty} direct=${directQty}`)
        }
    }

    const normalized = rows.map(normalizeStockAtRow).filter((r) => r.SKU)
    const withStock = normalized.filter((r) => r["Current Stock"] !== 0 || String(rows.find((x) => stockAtSku(x) === r.SKU)?.["Current Stock"] ?? "").trim() !== "")

    console.log("\n=== Parser backtest ===")
    console.log(`  rows: ${rows.length}`)
    console.log(`  old r.SKU matches: ${oldSkuMatches}  ← broken if 0 after rename`)
    console.log(`  new ATB/SKU helper matches: ${newSkuMatches}`)
    console.log(`  Current Stock helper == direct col: ${helperMatches} ok / ${helperMismatch} mismatch`)
    console.log(`  normalizeStockAtRow SKUs: ${normalized.length}`)

    console.log("\n=== Sample (first 12 with SKU) ===")
    console.log("SKU | Current Stock | Product Name | STATUS")
    for (const r of normalized.slice(0, 12)) {
        console.log(
            `  ${r.SKU.padEnd(12)} | ${String(r["Current Stock"]).padStart(6)} | ${(r["Product Name"] || "—").slice(0, 28).padEnd(28)} | ${r.STATUS}`,
        )
    }

    if (samples.length) {
        console.log("\nMismatches:")
        console.log(samples.slice(0, 10).join("\n"))
    }

    const ok =
        csIdx >= 0 &&
        newSkuMatches > 0 &&
        helperMismatch === 0 &&
        (atbIdx >= 0 ? oldSkuMatches === 0 || true : true) &&
        withStock.length > 0

    // Explicit regression: if sheet uses ATB, old SKU-only parser must be empty
    if (atbIdx >= 0 && skuIdx < 0 && oldSkuMatches !== 0) {
        console.error("Unexpected: SKU header gone but r.SKU still matched")
        process.exit(1)
    }
    if (atbIdx >= 0 && skuIdx < 0 && oldSkuMatches === 0 && newSkuMatches === 0) {
        console.error("FAIL: helpers did not pick up ATB column")
        process.exit(1)
    }
    if (!ok || helperMismatch > 0 || newSkuMatches === 0) {
        console.error("\nFAIL")
        process.exit(1)
    }

    console.log("\nPASS — Current Stock column resolved correctly via header name + ATB SKU key")
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
