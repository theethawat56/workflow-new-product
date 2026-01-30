"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { addAttachmentAction, uploadAttachmentAction } from "@/app/actions/attachment"
import { debugDriveAccessAction } from "@/app/actions/debug"
import { LinkIcon, AlertTriangle } from "lucide-react"

interface Props {
    productId: string
    attachments: any[]
}

export function AttachmentsList({ productId, attachments }: Props) {
    const [url, setUrl] = useState("")
    const [type, setType] = useState("Other")
    const [submitting, setSubmitting] = useState(false)
    const [uploadMode, setUploadMode] = useState("link") // 'link' or 'file'
    const [file, setFile] = useState<File | null>(null)

    const handleAddLink = async () => {
        if (!url) return
        setSubmitting(true)
        await addAttachmentAction(productId, "", url, type)
        setSubmitting(false)
        setUrl("")
    }

    const handleUploadFile = async () => {
        if (!file) return
        setSubmitting(true)

        const formData = new FormData()
        formData.append("file", file)

        await uploadAttachmentAction(productId, type, formData)

        setSubmitting(false)
        setFile(null)
        // Reset file input manually if needed or let React handle key
    }

    const handleDebug = async () => {
        const res = await debugDriveAccessAction()
        if (res.success) {
            alert(`✅ Access Granted!\nFolder: ${res.details?.folderName}\nEmail: ${res.details?.email}`)
        } else {
            alert(`❌ Access Failed!\nReason: ${res.error?.message || res.message}\nEmail used: ${res.email}\n\nPlease share the folder with this email as Editor.`)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Tabs defaultValue="link" onValueChange={setUploadMode} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                        <TabsTrigger value="link">Add via Link</TabsTrigger>
                        <TabsTrigger value="file">Upload File</TabsTrigger>
                    </TabsList>
                </Tabs>
                <Button variant="outline" size="sm" onClick={handleDebug} className="text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100">
                    <AlertTriangle className="w-3 h-3 mr-2" />
                    Debug Access
                </Button>
            </div>

            {uploadMode === 'link' || uploadMode === 'file' ? (
                <div className="flex gap-4 items-end border p-4 rounded-md mt-4 bg-slate-50">
                    <div className="space-y-2 flex-1">
                        {uploadMode === 'link' ? (
                            <>
                                <label className="text-sm font-medium">Drive URL</label>
                                <Input key="url-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/..." />
                            </>
                        ) : (
                            <>
                                <label className="text-sm font-medium">Choose File</label>
                                <Input key="file-input" type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
                            </>
                        )}
                    </div>
                    <div className="space-y-2 w-[180px]">
                        <label className="text-sm font-medium">Type</label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Spec">Spec</SelectItem>
                                <SelectItem value="Manual">Manual</SelectItem>
                                <SelectItem value="Images">Images</SelectItem>
                                <SelectItem value="MarketingMaterial">Marketing</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={uploadMode === 'link' ? handleAddLink : handleUploadFile} disabled={submitting}>
                        {submitting ? "Adding..." : (uploadMode === 'link' ? "Add Link" : "Upload")}
                    </Button>
                </div>
            ) : null}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Link</TableHead>
                            <TableHead>Added At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {attachments.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center">No attachments.</TableCell></TableRow>
                        ) : (
                            attachments.map(a => (
                                <TableRow key={a.attachment_id}>
                                    <TableCell>{a.type}</TableCell>
                                    <TableCell>
                                        <a href={a.drive_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:underscore">
                                            <LinkIcon className="h-4 w-4 mr-2" />
                                            Open
                                        </a>
                                    </TableCell>
                                    <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
