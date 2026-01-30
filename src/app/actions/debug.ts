"use server"

import { getDriveClient } from "@/lib/google/drive"

export async function debugDriveAccessAction() {
    const drive = await getDriveClient()
    const folderId = "13fcUC1dRmeCBEfYaCP_vJW3bkIGWNxqg"
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL

    try {
        console.log("--- DEBUG START ---")
        console.log("Service Account:", email)
        console.log("Target Folder:", folderId)

        // 1. Try to get folder metadata
        const folder = await drive.files.get({
            fileId: folderId,
            supportsAllDrives: true,
            fields: "id, name, capabilities, owners, driveId"
        })

        console.log("Folder Access: SUCCESS")
        console.log("Folder Name:", folder.data.name)
        console.log("Can Add Children:", folder.data.capabilities?.canAddChildren)

        // 2. Try to verify WE can write to it by ACTUALLY writing a file
        console.log("Attempting TEST UPLOAD to target folder...")
        const testFile = await drive.files.create({
            requestBody: {
                name: 'debug_test_file.txt',
                parents: [folderId]
            },
            media: {
                mimeType: 'text/plain',
                body: 'Hello Google Drive. This is a permission test.'
            },
            fields: 'id',
            supportsAllDrives: true
        })
        console.log("Test Upload: SUCCESS, ID:", testFile.data.id)

        // Clean up - delete the test file
        try {
            await drive.files.delete({ fileId: testFile.data.id!, supportsAllDrives: true })
            console.log("Test File Cleanup: SUCCESS")
        } catch (cleanupError) {
            console.warn("Could not delete test file:", cleanupError)
        }

        return {
            success: true,
            message: "✅ WRITE TEST PASSED! The bot can definitely upload files now.",
            details: {
                email,
                folderName: folder.data.name,
                canAddChildren: folder.data.capabilities?.canAddChildren,
                isSharedDrive: !!folder.data.driveId,
                writeTest: "Passed"
            }
        }

    } catch (error: any) {
        console.error("--- DEBUG ERROR ---")
        const errorData = error.response?.data?.error || error.message
        console.error(JSON.stringify(errorData, null, 2))

        // If target fails, try ROOT test to see if account is alive at all
        try {
            console.log("Attempting ROOT upload test...")
            await drive.files.create({
                requestBody: { name: 'test_connectivity.txt' },
                media: { mimeType: 'text/plain', body: 'Hello' }
            })
            console.log("Root upload: SUCCESS")
            // If root works, then credentials are good, just folder perm is bad
            return {
                success: false,
                message: "Credentials are VALID, but access to the TARGET FOLDER is denied.",
                error: { message: "Your Service Account is working, but it was refused access to the specific folder ID. Please check the 'Share' settings again." },
                email
            }
        } catch (rootError: any) {
            console.error("Root upload failed:", rootError.message)
            // If root fails, then credentials/API are bad OR just no quota
            return {
                success: false,
                message: "Upload Failed!",
                error: {
                    message: "Failed to write to Target Folder. Reason: " + (error.message || "Unknown"),
                    details: errorData,
                    rootError: rootError.message
                },
                email
            }
        }
    }
}
