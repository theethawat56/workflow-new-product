import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const MAX_SIZES: Record<string, number> = {
    product: 10 * 1024 * 1024,  // 10 MB
    contact: 5 * 1024 * 1024,   // 5 MB
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        const type = (req.nextUrl.searchParams.get("type") || "product") as string

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 })
        }

        // Validate MIME type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 })
        }

        // Validate file size
        const maxSize = MAX_SIZES[type] ?? MAX_SIZES.product
        if (file.size > maxSize) {
            const maxMB = maxSize / (1024 * 1024)
            return NextResponse.json({ error: `File too large. Max size: ${maxMB} MB` }, { status: 400 })
        }

        // Create upload directory if it doesn't exist
        const uploadDir = join(process.cwd(), "public", "uploads", "products")
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true })
        }

        // Generate unique filename
        const ext = file.name.split(".").pop() || "jpg"
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-z0-9.-]/gi, "_").toLowerCase()
        const filename = `${type}_${timestamp}_${safeName}`
        const filepath = join(uploadDir, filename)

        // Write file to disk
        const bytes = await file.arrayBuffer()
        await writeFile(filepath, Buffer.from(bytes))

        const url = `/uploads/products/${filename}`
        return NextResponse.json({ url }, { status: 200 })
    } catch (error: any) {
        console.error("[Upload API]", error)
        return NextResponse.json({ error: "Upload failed: " + error.message }, { status: 500 })
    }
}
