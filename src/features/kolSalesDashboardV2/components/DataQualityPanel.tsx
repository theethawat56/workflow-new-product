import { DataQualityIssue } from "../types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export function DataQualityPanel({ issues }: { issues: DataQualityIssue[] }) {
    if (issues.length === 0) return null

    return (
        <div className="mb-4">
            <Accordion type="single" collapsible>
                <AccordionItem value="item-1" className="border-none">
                    <AccordionTrigger className="py-2 hover:no-underline">
                        <div className="flex items-center text-amber-600 gap-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-semibold">{issues.reduce((a, b) => a + b.count, 0)} Data Quality Issues Found</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900 mt-2">
                            <AlertTitle>Action Required</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc pl-4 space-y-1 text-xs mt-2">
                                    {issues.map((i, idx) => (
                                        <li key={idx}>
                                            <strong>{i.type}</strong> ({i.count} rows): <br />
                                            <span className="opacity-75">Samples: {i.samples.join(", ")}</span>
                                        </li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )
}
