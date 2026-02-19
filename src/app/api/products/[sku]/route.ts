
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getProductBySku, getProductExtendedInfo } from "@/lib/workspace/tools";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ sku: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sku = (await params).sku;

    try {
        const product = await getProductBySku(sku);
        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        // Enhance with extra info if possible
        let extended = {};
        if (product.product_id) {
            extended = await getProductExtendedInfo(product.product_id) || {};
        }

        return NextResponse.json({ ...product, ...extended });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
