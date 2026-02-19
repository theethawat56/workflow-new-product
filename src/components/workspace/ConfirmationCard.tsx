import * as React from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Message, ConfirmationData } from "@/lib/workspace/types"
import { AlertCircle, Check, X } from "lucide-react"

interface ConfirmationCardProps {
    message: Message
    onConfirm: (messageId: string, payload: any) => void
    onCancel: (messageId: string) => void
}

export function ConfirmationCard({ message, onConfirm, onCancel }: ConfirmationCardProps) {
    const data = message.data as ConfirmationData
    const [status, setStatus] = React.useState<"pending" | "confirmed" | "cancelled">("pending")

    const handleConfirm = () => {
        setStatus("confirmed")
        onConfirm(message.id, data.payload)
    }

    const handleCancel = () => {
        setStatus("cancelled")
        onCancel(message.id)
    }

    if (status !== "pending") {
        return (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground bg-muted/50 rounded-lg border">
                {status === "confirmed" ? (
                    <>
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Action confirmed</span>
                    </>
                ) : (
                    <>
                        <X className="h-4 w-4 text-red-500" />
                        <span>Action cancelled</span>
                    </>
                )}
            </div>
        )
    }

    return (
        <Card className="w-full max-w-md border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-base font-medium text-orange-900">
                        {data.summary || "Confirmation Required"}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="pb-2">
                <p className="text-sm text-orange-800">
                    {data.description || "Are you sure you want to proceed with this action?"}
                </p>
                {/* Debug Payload View - optional, kept simple for MVP */}
                {/* <pre className="mt-2 text-xs bg-white/50 p-2 rounded overflow-auto max-h-20">
                    {JSON.stringify(data.payload, null, 2)}
                </pre> */}
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="text-orange-900 hover:text-orange-950 hover:bg-orange-100"
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={handleConfirm}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                    Confirm Action
                </Button>
            </CardFooter>
        </Card>
    )
}
