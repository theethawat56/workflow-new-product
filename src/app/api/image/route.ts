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
        const status = error?.response?.status ?? error?.code ?? "unknown"
        const message = error?.response?.data?.error?.message ?? error?.message ?? "unknown error"
        console.error(`[Image Proxy] fileId=${fileId} status=${status} message=${message}`)
        if (error?.response?.data) {
            console.error("[Image Proxy] response data:", JSON.stringify(error.response.data))
        }

        // In non-production return the real reason so it's easy to debug
        const isDev = process.env.NODE_ENV !== "production"
        return NextResponse.json(
            { error: "Image not found", ...(isDev && { reason: message, status }) },
            { status: 404 }
        )
    }
}
