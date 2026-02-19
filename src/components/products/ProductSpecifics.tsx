"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Pencil, Save, X } from "lucide-react"
import { updateProductSpecificAction } from "@/app/actions/product"
import { useRouter } from "next/navigation"

interface ProductSpecificsProps {
    productId: string
    tasks: any[]
}

const SPECIFIC_ITEMS = [
    { code: "DET1", name: "Key Feature" },
    { code: "DET2", name: "Target Customer" },
    { code: "DET3", name: "SpecSheet" },
    { code: "DET4", name: "In-Box items" },
    { code: "DET5", name: "Box Dimension" },
]

export function ProductSpecifics({ productId, tasks }: ProductSpecificsProps) {
    const router = useRouter()
    const [editingCode, setEditingCode] = useState<string | null>(null)
    const [editContent, setEditContent] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    // Helper to get current content
    const getContent = (code: string) => {
        const task = tasks.find(t => t.task_code === code)
        return task?.notes || ""
    }

    const handleEdit = (code: string) => {
        setEditingCode(code)
        setEditContent(getContent(code))
    }

    const handleCancel = () => {
        setEditingCode(null)
        setEditContent("")
    }

    const handleSave = async (code: string) => {
        setIsSaving(true)
        const res = await updateProductSpecificAction(productId, code, editContent)

        if (res.success) {
            setEditingCode(null)
            router.refresh()
        } else {
            alert("Failed to save: " + res.message)
        }
        setIsSaving(false)
    }

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Product Specifics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
                {SPECIFIC_ITEMS.map((item) => {
                    const isEditing = editingCode === item.code
                    const content = getContent(item.code)
                    const hasContent = content && content.trim().length > 0

                    return (
                        <div key={item.code} className="border p-4 rounded-md relative group">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-semibold text-sm text-muted-foreground">{item.name}</h4>
                                {!isEditing && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleEdit(item.code)}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="space-y-2">
                                    <Textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="min-h-[100px]"
                                        placeholder={`Enter ${item.name}...`}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                                            <X className="h-3 w-3 mr-1" /> Cancel
                                        </Button>
                                        <Button size="sm" onClick={() => handleSave(item.code)} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm min-h-[24px]">
                                    {hasContent ? (
                                        <div className="whitespace-pre-wrap">{content}</div>
                                    ) : (
                                        <div
                                            className="text-muted-foreground italic cursor-pointer hover:bg-muted/50 p-1 rounded -ml-1 transition-colors"
                                            onClick={() => handleEdit(item.code)}
                                        >
                                            Click to add {item.name}...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
