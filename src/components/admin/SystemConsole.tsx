"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Play, Download, XCircle, CheckCircle, Activity } from "lucide-react"

interface SystemConsoleProps {
    user: {
        email: string
        role: string
    }
}

interface Trace {
    id: string
    timestamp: string
    input: string
    intent: string
    sku: string | null
    pending_intent_before: any
    pending_intent_after: any
    stage: string
    error?: string
    full_response: any
}

export function SystemConsole({ user }: SystemConsoleProps) {
    const [traces, setTraces] = useState<Trace[]>([])
    const [isRunning, setIsRunning] = useState(false)
    const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null)
    const [consoleLogs, setConsoleLogs] = useState<string[]>([])

    const addLog = (msg: string) => setConsoleLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev])

    const runSmokeTests = async () => {
        setIsRunning(true)
        addLog("Starting Smoke Tests...")

        try {
            // Flow A: Ask without SKU
            addLog("Test A: Missing SKU...")
            const resA = await fetch("/api/workspace/chat", {
                method: "POST",
                body: JSON.stringify({
                    last_user_message: { content: "ขอข้อมูลสินค้า" }, // Thai intentional
                    context: { currentSku: null }
                })
            })
            const dataA = await resA.json()
            recordTrace("Flow A", "ขอข้อมูลสินค้า", dataA)

            if (dataA.updated_context?.pending_intent) {
                addLog("✅ Test A Passed: Pending Intent Set")
            } else {
                addLog("❌ Test A Failed: No Pending Intent")
            }

            // Flow A2: Resolve SKU
            addLog("Test A2: Resolve SKU...")
            const resA2 = await fetch("/api/workspace/chat", {
                method: "POST",
                body: JSON.stringify({
                    last_user_message: { content: "TEST001" },
                    context: {
                        currentSku: null,
                        pending_intent: dataA.updated_context.pending_intent
                    }
                })
            })
            const dataA2 = await resA2.json()
            recordTrace("Flow A2", "TEST001", dataA2)

            if (dataA2.updated_context?.currentSku === "TEST001" && !dataA2.updated_context?.pending_intent) {
                addLog("✅ Test A2 Passed: Intent Resolved & Cleared")
            } else {
                addLog("❌ Test A2 Failed: Context State Invalid")
            }

            // Flow B: Ambiguous
            addLog("Test B: Ambiguous...")
            const resB = await fetch("/api/workspace/chat", {
                method: "POST",
                body: JSON.stringify({
                    last_user_message: { content: "ambiguous" },
                    context: { currentSku: null }
                })
            })
            const dataB = await resB.json()
            recordTrace("Flow B", "ambiguous", dataB)

            if (dataB.ui_events?.some((e: any) => e.type === "choose_product")) {
                addLog("✅ Test B Passed: UI Event Received")
            } else {
                addLog("❌ Test B Failed: No choose_product event")
            }

        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`)
        } finally {
            setIsRunning(false)
            addLog("Smoke Tests Completed.")
        }
    }

    const recordTrace = (stage: string, input: string, data: any) => {
        const trace: Trace = {
            id: Date.now().toString() + Math.random(),
            timestamp: new Date().toISOString(),
            input,
            intent: data.debug_trace?.router_decision || "unknown",
            sku: data.updated_context?.currentSku || null,
            pending_intent_before: data.debug_trace?.pending_intent_before,
            pending_intent_after: data.debug_trace?.pending_intent_after,
            stage,
            full_response: data
        }
        setTraces(prev => [trace, ...prev].slice(0, 50))
    }

    const exportTraces = () => {
        const blob = new Blob([JSON.stringify(traces, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `system_traces_${new Date().toISOString()}.json`
        a.click()
    }

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-7xl">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="h-6 w-6 text-blue-500" />
                    System Summary & Debug Console
                </h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportTraces} disabled={traces.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> Export Traces
                    </Button>
                    <Button onClick={runSmokeTests} disabled={isRunning}>
                        {isRunning ? "Running..." : "Run Smoke Tests"} <Play className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Panel 1: Session & Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Session & Context</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center p-2 bg-slate-100 dark:bg-slate-800 rounded">
                            <span className="text-xs font-mono">{user.email}</span>
                            <Badge variant={user.role === "admin" ? "default" : "destructive"}>
                                {user.role}
                            </Badge>
                        </div>
                        <div className="text-xs text-slate-500">
                            Simulated Client State: <br />
                            SKU: {traces[0]?.sku || "None"} <br />
                            Pending: {traces[0]?.pending_intent_after ? "YES" : "NO"}
                        </div>
                    </CardContent>
                </Card>

                {/* Panel 2: Pipeline Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Pipeline Config (Read-Only)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-50 p-2 rounded">
                                <strong>Intents</strong><br />
                                - greeting<br />
                                - product_info<br />
                                - create_checklist
                            </div>
                            <div className="bg-slate-50 p-2 rounded">
                                <strong>Tools</strong><br />
                                - searchProducts<br />
                                - searchWorkspace<br />
                                - createTasksBatch
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Panel 3: Console Logs */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Smoke Test Logs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[120px] w-full rounded border p-2 text-xs font-mono bg-black text-green-400">
                            {consoleLogs.length === 0 ? "Ready to start..." : consoleLogs.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Panel 4: Trace Viewer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Recent Activity (In-Memory)</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="space-y-2">
                                {traces.map(trace => (
                                    <div
                                        key={trace.id}
                                        onClick={() => setSelectedTrace(trace)}
                                        className={`p-3 border rounded cursor-pointer hover:bg-slate-50 transition-colors ${selectedTrace?.id === trace.id ? 'border-blue-500 bg-blue-50' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <Badge variant="outline">{trace.intent}</Badge>
                                            <span className="text-[10px] text-slate-400">{new Date(trace.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="text-sm font-medium truncate">"{trace.input}"</div>
                                        <div className="flex gap-2 mt-2 text-[10px] text-slate-500">
                                            <span>SKU: {trace.sku || "-"}</span>
                                            <span>Pending: {trace.pending_intent_after ? "SET" : "CLR"}</span>
                                        </div>
                                    </div>
                                ))}
                                {traces.length === 0 && <div className="text-center text-slate-400 py-10">No traces yet</div>}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Trace Details</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden bg-slate-900 text-slate-300 font-mono text-xs p-0">
                        <ScrollArea className="h-full p-4">
                            {selectedTrace ? (
                                <pre>{JSON.stringify(selectedTrace.full_response, null, 2)}</pre>
                            ) : (
                                <div className="flex h-full items-center justify-center text-slate-500">
                                    Select a trace to view details
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
