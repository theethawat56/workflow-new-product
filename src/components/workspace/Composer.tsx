"use client"

import * as React from "react"
import { SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ComposerProps {
    isLoading: boolean
    onSend: (value: string) => void
}

export function Composer({ isLoading, onSend }: ComposerProps) {
    const [input, setInput] = React.useState("")

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!input.trim() || isLoading) return
        onSend(input)
        setInput("")
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex w-full items-end gap-2 p-4 border-t border-border bg-background"
        >
            <Textarea
                placeholder="Ask about products, tasks, or launch status..."
                className="min-h-[44px] md:min-h-[60px] w-full resize-none text-base md:text-sm py-3"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
            />
            <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="mb-1"
            >
                <SendHorizontal className="h-4 w-4" />
                <span className="sr-only">Send</span>
            </Button>
        </form>
    )
}
