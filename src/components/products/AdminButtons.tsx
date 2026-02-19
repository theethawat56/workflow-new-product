import { useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { EditProductDialog } from "@/components/products/EditProductDialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

interface AdminButtonsProps {
    productId: string
    isDeleting: boolean
    onDelete: () => void
    product: any
}

export function AdminButtons({ isDeleting, onDelete, product }: AdminButtonsProps) {
    const { data: session } = useSession()
    const [open, setOpen] = useState(false)

    // Check if user is Admin
    if (session?.user?.role !== "Admin") return null

    const handleConfirmDelete = async () => {
        await onDelete()
        setOpen(false)
    }

    return (
        <div className="flex items-center gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isDeleting ? "Deleting..." : "Delete Product"}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Are you absolutely sure?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete the product
                            <span className="font-semibold text-foreground"> {product.product_name} </span>
                            and remove it from our servers.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" type="button">Cancel</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete Product
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <EditProductDialog product={product} />
        </div>
    )
}
