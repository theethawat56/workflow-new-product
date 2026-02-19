"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Message, ProductSummary } from "@/lib/workspace/types"
import { Bot, User, Box, Calendar } from "lucide-react"
import { ConfirmationCard } from "./ConfirmationCard"

import { MarkdownText } from "./MarkdownText"

interface ChatThreadProps {
    messages: Message[]
    onSelect?: (item: any) => void
    onConfirmAction?: (id: string, payload: any) => void
    onCancelAction?: (id: string) => void
}

export function ChatThread({ messages, onSelect, onConfirmAction, onCancelAction }: ChatThreadProps) {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <Bot className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">Welcome to LaunchFlow Workspace</p>
                <p className="text-sm">Ask me anything about your products and launches.</p>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
            {messages.map((message) => (
                <div
                    key={message.id}
                    className={cn(
                        "flex w-full gap-3",
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                >
                    <div
                        className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                            message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground"
                        )}
                    >
                        {message.role === "user" ? (
                            <User className="h-4 w-4" />
                        ) : (
                            <Bot className="h-4 w-4" />
                        )}
                    </div>
                    <div
                        className={cn(
                            "flex max-w-[80%] flex-col gap-2 rounded-lg px-4 py-3 text-sm shadow-sm",
                            message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground"
                        )}
                    >
                        {message.type === 'confirmation_request' ? (
                            <ConfirmationCard
                                message={message}
                                onConfirm={onConfirmAction || (() => { })}
                                onCancel={onCancelAction || (() => { })}
                            />
                        ) : (
                            <MarkdownText content={message.content} />
                        )}

                        {message.type === 'product_card' && message.data && (
                            <div className="grid gap-2 mt-2 sm:grid-cols-2">
                                {(message.data as ProductSummary[]).map((product) => (
                                    <div
                                        key={product.sku}
                                        className="bg-card border rounded-md p-3 cursor-pointer hover:border-primary transition-colors text-card-foreground"
                                        onClick={() => onSelect?.(product)}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Box className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-semibold">{product.sku}</span>
                                        </div>
                                        <div className="text-sm truncate" title={product.name}>{product.name}</div>
                                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded-full bg-slate-100",
                                                product.status === 'Active' && "bg-green-100 text-green-700",
                                                product.status === 'Draft' && "bg-yellow-100 text-yellow-700"
                                            )}>
                                                {product.status}
                                            </span>
                                            {product.launchDate && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {product.launchDate}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {message.type === 'task_list' && message.data && (
                            <div className="space-y-2 mt-2">
                                {(message.data as any[]).map((task, i) => (
                                    <div
                                        key={i}
                                        className="bg-card border rounded-md p-2 text-xs flex items-center justify-between"
                                        style={{ backgroundColor: 'white' }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                task.status === 'Done' ? "bg-green-500" :
                                                    task.status === 'InProgress' ? "bg-blue-500" :
                                                        task.status === 'Blocked' ? "bg-red-500" : "bg-slate-300"
                                            )} />
                                            <span className="font-medium text-slate-700">{task.task_name}</span>
                                        </div>
                                        <div className="text-muted-foreground">{task.due_date}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
