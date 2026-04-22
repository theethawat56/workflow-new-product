import { ShippingCalculator } from "@/components/shipping-calculator/shipping-calculator"

export const metadata = {
    title: "Shipping Calculator",
    description: "Calculate CBM, weight and shipping cost from China to Thailand",
}

export default function ShippingCalculatorPage() {
    return <ShippingCalculator />
}
