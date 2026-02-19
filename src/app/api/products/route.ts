
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheet } from "@/lib/workspace/data-source";
import { searchProducts } from "@/lib/workspace/tools";
import { Product } from "@/lib/workspace/types";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    try {
        if (query) {
            const results = await searchProducts(query, 20); // Higher limit for API
            return NextResponse.json(results);
        } else {
            // Return all products
            const products = await fetchSheet<Product>("products");
            return NextResponse.json(products);
        }
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
