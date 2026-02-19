"use client"

import * as React from "react"
import { Search, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { searchProductsAction } from "@/app/actions/workspace"
import { ProductSummary } from "@/lib/workspace/types"
import { cn } from "@/lib/utils"

interface SearchOverlayProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (sku: string) => void
}

export function SearchOverlay({ open, onOpenChange, onSelect }: SearchOverlayProps) {
    const [query, setQuery] = React.useState("")
    const [results, setResults] = React.useState<ProductSummary[]>([])
    const [isLoading, setIsLoading] = React.useState(false)

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length < 2) {
                setResults([])
                return
            }

            setIsLoading(true)
            try {
                const data = await searchProductsAction(query)
                setResults(data)
            } catch (error) {
                console.error("Search error:", error)
            } finally {
                setIsLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="text-base font-normal flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Search Products
                    </DialogTitle>
                </DialogHeader>

                <div className="p-4 border-b">
                    <Input
                        placeholder="Search by name or SKU..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="bg-muted/50 border-none focus-visible:ring-0 px-0 text-lg sm:text-lg shadow-none"
                    />
                </div>

                <div className="max-h-[300px] min-h-[100px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                            Searching...
                        </div>
                    ) : results.length > 0 ? (
                        <ScrollArea className="h-[300px]">
                            <div className="flex flex-col">
                                {results.map((product) => (
                                    <button
                                        key={product.sku}
                                        className="flex flex-col items-start gap-1 p-4 hover:bg-muted/50 text-left transition-colors border-b last:border-0"
                                        onClick={() => {
                                            onSelect(product.sku)
                                            onOpenChange(false)
                                        }}
                                    >
                                        <div className="font-medium text-sm">{product.name}</div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="font-mono">{product.sku}</span>
                                            <span>•</span>
                                            <span className={cn(
                                                "capitalize",
                                                product.status.toLowerCase() === 'active' ? "text-green-600" : ""
                                            )}>
                                                {product.status}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : query.length >= 2 ? (
                        <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
                            No results found.
                        </div>
                    ) : (
                        <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
                            Type to search...
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
