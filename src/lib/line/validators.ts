export const validators = {
    sku_code: (v: string) => /^[A-Z0-9\-]{4,20}$/.test(v),
    price: (v: any) => !isNaN(Number(v)) && Number(v) > 0,
    cost: (v: any) => !isNaN(Number(v)) && Number(v) > 0,
    moq: (v: any) => !isNaN(Number(v)) && Number(v) >= 1,
    lead_time_days: (v: any) => !isNaN(Number(v)) && Number(v) >= 0,
    product_name: (v: string) => v.trim().length >= 2,
    brand: (v: string) => v.trim().length >= 1,
    supplier_name: (v: string) => v.trim().length >= 1,
}
