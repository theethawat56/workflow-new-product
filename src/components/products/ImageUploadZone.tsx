"use client"

import { useRef, useState, DragEvent, ChangeEvent } from "react"
import { Upload, X, Image as ImageIcon, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
    label: string
    hint: string
    icon?: "image" | "card"
    accentColor?: "teal" | "violet"
    value: File | null
    onChange: (file: File | null) => void
}

export function ImageUploadZone({
    label,
    hint,
    icon = "image",
    accentColor = "teal",
    value,
    onChange,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)

    const accent = accentColor === "teal"
        ? {
            border: "border-teal-400/50",
            bg: "bg-teal-500/10",
            icon: "text-teal-400",
            text: "text-teal-400",
            hover: "hover:border-teal-400 hover:bg-teal-500/20",
            drag: "border-teal-400 bg-teal-500/20",
        }
        : {
            border: "border-violet-400/50",
            bg: "bg-violet-500/10",
            icon: "text-violet-400",
            text: "text-violet-400",
            hover: "hover:border-violet-400 hover:bg-violet-500/20",
            drag: "border-violet-400 bg-violet-500/20",
        }

    const handleFile = (file: File) => {
        onChange(file)
        const reader = new FileReader()
        reader.onload = (e) => setPreview(e.target?.result as string)
        reader.readAsDataURL(file)
    }

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith("image/")) handleFile(file)
    }

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
    }

    const handleRemove = () => {
        onChange(null)
        setPreview(null)
        if (inputRef.current) inputRef.current.value = ""
    }

    return (
        <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{label}</p>

            {/* Drop Zone */}
            <div
                className={cn(
                    "relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all duration-200",
                    accent.border, accent.bg, accent.hover,
                    isDragging && accent.drag
                )}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleChange}
                />

                {preview ? (
                    <div className="relative group flex justify-center">
                        <img
                            src={preview}
                            alt="Preview"
                            className="max-h-48 w-auto rounded-lg object-contain shadow-md"
                        />
                        {/* Remove overlay */}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRemove() }}
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 py-4 select-none">
                        <div className={cn("p-3 rounded-full", accent.bg)}>
                            {icon === "card"
                                ? <CreditCard className={cn("h-7 w-7", accent.icon)} />
                                : <ImageIcon className={cn("h-7 w-7", accent.icon)} />
                            }
                        </div>
                        <div className="text-center">
                            <p className={cn("text-sm font-medium", accent.text)}>
                                Click to upload or drag &amp; drop
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{hint}</p>
                        </div>
                        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground")}>
                            <Upload className="h-3 w-3" />
                            <span>Browse files</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Status badge */}
            {value ? (
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg text-xs">
                    <span className="text-foreground font-medium truncate max-w-[200px]">{value.name}</span>
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{(value.size / 1024).toFixed(0)} KB</span>
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="text-destructive hover:text-destructive/80 transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground text-center">No image selected</p>
            )}
        </div>
    )
}
