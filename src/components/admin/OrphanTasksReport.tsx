"use client"

import { useState } from "react"
import { getOrphanTasksReport } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"

export function OrphanTasksReport() {
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    const handleCheck = async () => {
        setLoading(true)
        setError(null)
        setReport(null)
        try {
            const result = await getOrphanTasksReport()
            if (result.success) {
                setReport(result)
            } else {
                setError(result.message)
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Orphan Tasks Report</CardTitle>
                <CardDescription>
                    Identify tasks that are assigned to product IDs which do not exist in the Products sheet.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={handleCheck} disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Check for Orphan Tasks
                </Button>

                {error && (
                    <div className="p-4 rounded-md bg-destructive/15 text-destructive border border-destructive/20 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 mt-0.5" />
                        <div>
                            <h5 className="font-medium mb-1">Error</h5>
                            <div className="text-sm opacity-90">{error}</div>
                        </div>
                    </div>
                )}

                {report && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5 p-4 border rounded-md">
                                <span className="text-sm font-medium text-muted-foreground">Total Orphan Tasks</span>
                                <span className="text-2xl font-bold">{report.totalOrphanTasks}</span>
                            </div>
                            <div className="flex flex-col space-y-1.5 p-4 border rounded-md">
                                <span className="text-sm font-medium text-muted-foreground">Unique Missing Product IDs</span>
                                <span className="text-2xl font-bold">{report.uniqueMissingProductIdsCount}</span>
                            </div>
                        </div>

                        {report.totalOrphanTasks === 0 ? (
                            <div className="p-4 rounded-md bg-green-50 text-green-900 border border-green-200 flex items-start gap-3">
                                <CheckCircle className="h-5 w-5 mt-0.5 text-green-600" />
                                <div>
                                    <h5 className="font-medium mb-1">All Good!</h5>
                                    <div className="text-sm opacity-90">No orphan tasks found.</div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 border rounded-md bg-muted/50">
                                <h4 className="mb-2 font-medium">Missing Product IDs:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {report.uniqueMissingProductIds.map((id: string) => (
                                        <span key={id} className="px-2 py-1 text-xs font-mono bg-background border rounded">
                                            {id}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
