export interface ZortoutGenericResponse<T> {
    success: boolean
    message?: string
    list: T[]
    count?: number
}

export interface ZortoutOrderItem {
    id: number
    productid: number
    sku: string
    name: string
    number: number // Quantity
    pricepernumber: number
    totalprice: number
    totalprice_pretax: number
    totalprice_vat: number
    discount?: string
    discountamount?: number
}

export interface ZortoutOrder {
    id: number
    number: string
    orderdate: string // ISO string
    saleschannel: string
    customername: string
    paymentstatus: string
    status: string
    shippingchannel?: string
    amount: number // Total amount
    list: ZortoutOrderItem[]
}
