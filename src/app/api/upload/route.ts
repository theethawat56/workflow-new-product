import { NextRequest, NextResponse } from "next/server"
import { getDriveClient } from "@/lib/google/drive"

// Force Node.js runtime — required for googleapis (uses streams, crypto, etc.)
export const runtime = "nodejs"

const MAX_SIZES: Record<string, number> = {
    product: 10 * 1024 * 1024, // 10 MB
    contact: 5 * 1024 * 1024,  // 5 MB
}

const PRODUCT_IMAGES_FOLDER_ID = "13fcUC1dRmeCBEfYaCP_vJW3bkIGWNxqg"

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        const type = (req.nextUrl.searchParams.get("type") || "product") as string

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 })
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 })
        }

        const maxSize = MAX_SIZES[type] ?? MAX_SIZES.product
        if (file.size > maxSize) {
            const maxMB = maxSize / (1024 * 1024)
            return NextResponse.json({ error: `File too large. Max ${maxMB} MB` }, { status: 400 })
        }

        // Convert to Buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Build a unique filename
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").toLowerCase()
        const fileName = `${type}_${timestamp}_${safeName}`

        // Upload directly to Google Drive
        const drive = await getDriveClient()

        // Use a PassThrough stream from the Buffer so googleapis can stream the body
        const { PassThrough } = await import("stream")
        const bodyStream = new PassThrough()
        bodyStream.end(buffer)

        const driveResponse = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [PRODUCT_IMAGES_FOLDER_ID],
            },
            media: {
                mimeType: file.type,
                body: bodyStream,
            },
            fields: "id",
            supportsAllDrives: true,
        })

        const fileId = driveResponse.data.id
        if (!fileId) {
            throw new Error("Drive upload returned no file ID")
        }

        // Make file publicly readable (required for <img src="..."> to work)
        await drive.permissions.create({
            fileId,
            supportsAllDrives: true,
            requestBody: {
                role: "reader",
                type: "anyone",
            },
        })

        // Direct embeddable URL
        const url = `https://drive.google.com/uc?export=view&id=${fileId}`
        return NextResponse.json({ url, fileId }, { status: 200 })

    } catch (error: any) {
        console.error("[Upload API - Drive]", error?.message || error)
        return NextResponse.json(
            { error: "Upload failed: " + (error?.message || "Unknown error") },
            { status: 500 }
        )
    }
}
