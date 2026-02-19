"use client"

import * as React from "react"
import { ChatThread } from "./ChatThread"
import { Composer } from "./Composer"
import { ContextPanel } from "./ContextPanel"
import { LeftRail } from "./LeftRail"
import { SearchOverlay } from "./SearchOverlay"
import { Message } from "@/lib/workspace/types"
import { getWorkspaceContextData } from "@/app/actions/workspace"

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, ChevronLeft, Plus, Search, ListTodo, LayoutDashboard } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatInterfaceProps {
    userRole: string
    userEmail?: string
}

import { useSearchParams, useRouter, usePathname } from "next/navigation"

export function ChatInterface({ userRole, userEmail }: ChatInterfaceProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // Initialize state from URL if present
    const initialSku = searchParams.get("sku") || undefined

    const [messages, setMessages] = React.useState<Message[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [errorTrace, setErrorTrace] = React.useState<string | null>(null)
    const [workspaceState, setWorkspaceState] = React.useState<any>({
        currentSku: initialSku
    })

    // Sync URL when state changes (optional, but better to handle selection explicitely)
    // Actually, let's update URL in handleSearchSelect and let state follow or just update both.

    // UI State for Context Panel
    const [contextData, setContextData] = React.useState<any>(null)
    const [isContextOpen, setIsContextOpen] = React.useState(false)
    const [isSearchOpen, setIsSearchOpen] = React.useState(false)

    // Fetch context data when SKU changes
    React.useEffect(() => {
        if (workspaceState.currentSku) {
            const fetchData = async () => {
                try {
                    const data = await getWorkspaceContextData(workspaceState.currentSku)
                    setContextData(data)
                    setIsContextOpen(true)
                } catch (error) {
                    console.error("Failed to fetch context data:", error)
                }
            }
            fetchData()
        }
    }, [workspaceState.currentSku])

    // Update state when URL changes (e.g. back button)
    React.useEffect(() => {
        const skuFromUrl = searchParams.get("sku")
        if (skuFromUrl && skuFromUrl !== workspaceState.currentSku) {
            setWorkspaceState((prev: any) => ({ ...prev, currentSku: skuFromUrl }))
        }
    }, [searchParams, workspaceState.currentSku])

    // SKU Regex (Letter-Digit combo or Hyphenated)
    const SKU_REGEX = /\b[A-Z]{2,6}\d{4,10}\b|\b[A-Z]{2,6}-\d{2,10}\b/i

    async function handleSendMessage(content: string) {
        setIsLoading(true)
        setErrorTrace(null) // Clear previous errors

        let finalContent = content.trim()
        let detectedSku = null

        // PR-3D.7: Check for SKU-only message
        const match = finalContent.match(SKU_REGEX)
        if (match && match[0] === finalContent) { // Exact match or single token
            detectedSku = match[0].toUpperCase()
            // Auto-update URL
            handleSearchSelect(detectedSku)
            // Normalize message
            finalContent = `เลือก ${detectedSku}`
        }

        // ALWAYS read from URL at submit time to ensure freshness (PR-3D.4)
        // If we just updated it above, handleSearchSelect updates state/URL, 
        // but URL update might be async/pending. 
        // So we prioritize 'detectedSku' if we just found one, otherwise URL.
        const skuFromUrl = new URLSearchParams(window.location.search).get("sku") || undefined
        const currentSku = detectedSku || skuFromUrl

        if (process.env.NODE_ENV !== "production") {
            console.log("[Chat Debug] Payload:", {
                content: finalContent,
                currentSku: currentSku,
                pending_intent: workspaceState.pending_intent
            })
        }

        // Add user message (Show what they typed, or the normalized one? User usually expects to see what they typed)
        // But for "selection", seeing "เลือก..." is also fine.
        // Let's show what they typed 'content' to be less intrusive, BUT user request said "send normalized message". 
        // I will display the NORMALIZED message to clarify to the user what happened.
        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: finalContent, // displaying normalized
            type: "text",
            timestamp: new Date()
        }
        setMessages((prev: Message[]) => [...prev, userMsg])

        try {
            const payload = {
                last_user_message: {
                    role: "user",
                    content: finalContent
                },
                context: {
                    // MUST be camelCase as per PR-3D.4 requirement
                    currentSku: currentSku || undefined,
                    pending_intent: workspaceState.pending_intent || undefined
                }
            }

            const res = await fetch("/api/workspace/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })

            const data = await res.json()

            if (process.env.NODE_ENV !== "production") {
                console.log("[Chat Debug] Response:", {
                    updated_context: data.updated_context,
                    ui_events: data.ui_events
                })
            }

            if (!res.ok) {
                // Check if it's a structured error with trace_id
                if (data.trace_id) {
                    setErrorTrace(data.trace_id)
                    console.error(`[Chat Error] Trace: ${data.trace_id}, Stage: ${data.stage}, Message: ${data.message}`)
                }
                throw new Error(data.message || `API Error: ${res.status}`)
            }

            // Map API response to UI Message
            const assistantMsg: Message = {
                id: Date.now().toString(),
                role: "assistant", // PR-3D.9: Enforce assistant role
                content: data.assistant_message.content,
                type: "text", // Default to text
                timestamp: new Date(),
                contextUpdates: {
                    // Fix: Map server response if it sends back currentSku
                    currentSku: data.updated_context?.currentSku || data.updated_context?.current_sku
                }
            }

            // Handle UI Events
            if (data.ui_events) {
                data.ui_events.forEach((event: any) => {
                    if (event.type === "show_confirmation") {
                        assistantMsg.type = "confirmation_request"
                        assistantMsg.data = event.payload
                    } else if (event.type === "choose_product") {
                        // Render as product cards
                        assistantMsg.type = "product_card"
                        assistantMsg.data = event.payload.candidates
                    } else if (event.type === "set_url_sku") {
                        // Auto-update URL if requested
                        handleSearchSelect(event.payload.sku)
                    }
                })
            }

            setMessages((prev: Message[]) => [...prev, assistantMsg])

            // Apply context updates
            if (data.updated_context) {
                const newSku = data.updated_context.currentSku || data.updated_context.current_sku

                // PR-3D.9: Strict URL Sync - If server says SKU changed, we MUST update URL
                // Check against current URL, not just state, to be safe
                const currentUrlSku = new URLSearchParams(window.location.search).get("sku")
                if (newSku && newSku !== currentUrlSku) {
                    handleSearchSelect(newSku)
                }

                setWorkspaceState((prev: any) => {
                    const next = { ...prev }

                    // Merge SKU
                    if (newSku) next.currentSku = newSku

                    // Merge Pending Intent (Handle null explicitly to clear)
                    if (data.updated_context.pending_intent === null) {
                        delete next.pending_intent
                    } else if (data.updated_context.pending_intent) {
                        next.pending_intent = data.updated_context.pending_intent
                    }

                    return next
                })
            }

        } catch (error) {
            console.error("Chat Error:", error)
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant", // Use assistant for friendly errors
                content: "ขอโทษครับ เกิดข้อผิดพลาดทางเทคนิค (Check console for Trace ID)",
                type: "error",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setIsLoading(false)
        }
    }

    const handleLeftRailAction = (action: string) => {
        if (action === "new_chat") {
            setMessages([])
            setWorkspaceState({})
            setContextData(null)
            setIsContextOpen(false)
            setErrorTrace(null)

            // Clear URL param
            const params = new URLSearchParams(searchParams)
            params.delete("sku")
            router.replace(`${pathname}?${params.toString()}`)

        } else if (action === "search_sku") {
            setIsSearchOpen(true)
        }
    }

    const handleSearchSelect = (sku: string) => {
        setWorkspaceState((prev: any) => ({ ...prev, currentSku: sku }))

        // Update URL
        const params = new URLSearchParams(searchParams)
        if (sku) {
            params.set("sku", sku)
        } else {
            params.delete("sku")
        }
        router.replace(`${pathname}?${params.toString()}`)
    }

    // Mobile Menu State
    // const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false) // Removed: Handled by App Shell

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Header removed: Handled by Workspace Layout */}

            <div className="flex-1 flex overflow-hidden relative">
                <SearchOverlay
                    open={isSearchOpen}
                    onOpenChange={setIsSearchOpen}
                    onSelect={handleSearchSelect}
                />

                {/* Column 1: Left Rail (Desktop Fixed) */}
                <div className="hidden md:flex">
                    <LeftRail onAction={handleLeftRailAction} userRole={userRole} />
                </div>

                {/* Column 2: Chat Area (Flexible) */}
                <div className="flex-1 flex flex-col min-w-0 h-full relative">
                    {/* Context Panel Overlay for Mobile (z-30 to be above chat but below toast) */}
                    {isContextOpen && (
                        <div className="absolute inset-0 md:relative md:w-[400px] md:border-l border-border bg-background z-30 flex flex-col h-full shadow-2xl md:shadow-none animate-in slide-in-from-right-10 md:animate-none">
                            {/* Mobile Close Button Header */}
                            <div className="md:hidden flex items-center justify-between p-2 border-b">
                                <span className="font-semibold text-sm pl-2">Context</span>
                                <Button variant="ghost" size="sm" onClick={() => setIsContextOpen(false)}>Close</Button>
                            </div>
                            <ContextPanel
                                data={contextData}
                                onClose={() => setIsContextOpen(false)}
                            />
                        </div>
                    )}

                    <div className={cn("flex-1 flex flex-col min-h-0", isContextOpen ? "hidden md:flex" : "flex")}>
                        <ChatThread
                            messages={messages}
                            onSelect={(item) => {
                                // Handle product card click
                                if (item.sku) {
                                    handleSearchSelect(item.sku)
                                    // Follow-up interaction
                                    handleSendMessage(`เลือก ${item.sku}`)
                                }
                            }}
                            onConfirmAction={async (id, payload) => {
                                setIsLoading(true)
                                try {
                                    const command = `EXECUTE_ACTION ${JSON.stringify(payload)}`
                                    await handleSendMessage(command)
                                } catch (error) {
                                    console.error("Execution failed:", error)
                                } finally {
                                    setIsLoading(false)
                                }
                            }}
                            onCancelAction={(id) => {
                                const cancelMsg: Message = {
                                    id: Date.now().toString(),
                                    role: "assistant",
                                    content: "Action cancelled.",
                                    type: "text",
                                    timestamp: new Date()
                                }
                                setMessages((prev: Message[]) => [...prev, cancelMsg])
                            }}
                        />
                        <div className="p-3 md:p-4 border-t border-border bg-background shrink-0 safe-area-bottom">
                            <Composer
                                isLoading={isLoading}
                                onSend={handleSendMessage}
                            />
                        </div>
                    </div>
                </div>

                {/* Column 3: Context Panel (Desktop Fixed Mode - handled inside flex above now?) 
                    Wait, if I put it inside Column 2 as a sibling to ChatThread, it splits the width.
                    Original was absolute or separate div?
                    Original: Column 3 was outside.
                    New plan: On mobile, it overlays. On Desktop, it sits aside.
                    Let's revert the structure slightly to keep Desktop side-by-side but Mobile overlay.
                */}
            </div>

            {/* Error Toast */}
            {errorTrace && (
                <div className="absolute bottom-6 right-6 z-50 bg-destructive text-destructive-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-5 max-w-[90vw]">
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">เกิดข้อผิดพลาด</p>
                        <p className="text-xs opacity-90 font-mono truncate">Trace ID: {errorTrace}</p>
                    </div>
                    <button
                        onClick={() => setErrorTrace(null)}
                        className="ml-2 hover:bg-black/20 p-1 rounded transition-colors shrink-0"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    )
}
