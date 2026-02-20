import { NextRequest, NextResponse } from "next/server"
import { getDriveClient } from "@/lib/google/drive"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
    const fileId = req.nextUrl.searchParams.get("fileId")

    if (!fileId) {
        return NextResponse.json({ error: "fileId is required" }, { status: 400 })
    }

    try {
        const drive = await getDriveClient()

        // Fetch the file as a stream from Google Drive
        const fileRes = await drive.files.get(
            { fileId, alt: "media", supportsAllDrives: true },
            { responseType: "arraybuffer" }
        )

        // Get content type from the drive file metadata
        const metaRes = await drive.files.get({
            fileId,
            fields: "mimeType",
            supportsAllDrives: true,
        })
        const mimeType = metaRes.data.mimeType || "image/jpeg"

        const buffer = Buffer.from(fileRes.data as ArrayBuffer)

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            },
        })
    } catch (error: any) {
        console.error("[Image Proxy]", error?.message)
        return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }
}
