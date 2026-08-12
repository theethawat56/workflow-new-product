# RobotMaker Analytics — Google Sheets Setup

Read-only dashboard at `/analytics` (Overview, New Products, Stock/ROP, Data Explorer).

## Spreadsheet

- Name: **WorkFlow_Product_data** (or your existing workflow spreadsheet)
- Tabs (read-only): `sales_orders`, `po_costs`
- Header row: row 1

## Service account setup

1. Google Cloud Console → enable **Google Sheets API**
2. Create a **Service Account** → download JSON key
3. Share the spreadsheet with the service account email as **Viewer**
4. Set env vars in `.env.local` / Vercel:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=<id from spreadsheet URL>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service account email>
GOOGLE_PRIVATE_KEY=<private key with \n escapes>
```

(`GOOGLE_SHEETS_ID` is also accepted as an alias.)

## Data layer

All sheet reads and metrics live in **`src/lib/analytics/data.ts`**.

- Cached for 1 hour via `unstable_cache`
- **Refresh data** button calls `POST /api/analytics/revalidate`

To swap Google Sheets for another source later, change only `src/lib/analytics/data.ts`.

## Routes

| Path | View |
|---|---|
| `/analytics` | Overview KPIs, share gauge, bridge, gainers/decliners |
| `/analytics/new-products` | Cohort table + scatter |
| `/analytics/stock` | Reorder / ROP (client-side stock inputs) |
| `/analytics/data` | Paginated joined rows + CSV export |
