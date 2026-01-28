"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { addAttachmentAction } from "@/app/actions/attachment"
import { LinkIcon } from "lucide-react"

interface Props {
    productId: string
    attachments: any[]
}

export function AttachmentsList({ productId, attachments }: Props) {
    const [url, setUrl] = useState("")
    const [type, setType] = useState("Other")
    const [submitting, setSubmitting] = useState(false)

    const handleAdd = async () => {
        if (!url) return
        setSubmitting(true)
        await addAttachmentAction(productId, "", url, type)
        setSubmitting(false)
        setUrl("")
    }

    return (
        <div className="space-y-6">
            <div className="flex gap-4 items-end border p-4 rounded-md">
                <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium">Drive URL</label>
                    <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/..." />
                </div>
                <div className="space-y-2 w-[180px]">
                    <label className="text-sm font-medium">Type</label>
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Spec">Spec</SelectItem>
                            <SelectItem value="Manual">Manual</SelectItem>
                            <SelectItem value="Images">Images</SelectItem>
                            <SelectItem value="MarketingMaterial">Marketing</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleAdd} disabled={submitting}>Add Link</Button>
            </div>

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
