"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORY_NAMES, PRODUCT_CATEGORIES } from "@/lib/constants"

export function AddExistingProductDialog() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        sku_code: "",
        product_name: "",
        category: "",
        sub_category: "",
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value })
    }

    const handleCategoryChange = (value: string) => {
        setFormData({ ...formData, category: value, sub_category: "" })
    }

    const handleSubCategoryChange = (value: string) => {
        setFormData({ ...formData, sub_category: value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const res = await fetch("/api/products/add-existing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            })

            const data = await res.json()

            if (!res.ok) {
                alert(data.error || "Failed to add product")
                return
            }

            setOpen(false)
            setFormData({ sku_code: "", product_name: "", category: "", sub_category: "" })
            router.refresh()
            alert("Product added successfully!")
        } catch (error) {
            console.error(error)
            alert("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    const subCategories = formData.category ? PRODUCT_CATEGORIES[formData.category] || [] : []

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Existing Product
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Existing Product</DialogTitle>
                    <DialogDescription>
                        Add a product that is already on sale. Use the exact Zort SKU for tracking.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="sku_code" className="text-right">
                            SKU
                        </Label>
                        <Input
                            id="sku_code"
                            value={formData.sku_code}
                            onChange={handleChange}
                            className="col-span-3"
                            required
                            placeholder="e.g. ATB-001"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product_name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="product_name"
                            value={formData.product_name}
                            onChange={handleChange}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">
                            Category
                        </Label>
                        <Select onValueChange={handleCategoryChange} value={formData.category}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORY_NAMES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="sub_category" className="text-right">
                            Sub-Category
                        </Label>
                        <Select
                            onValueChange={handleSubCategoryChange}
                            value={formData.sub_category}
                            disabled={!formData.category || subCategories.length === 0}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select sub-category" />
                            </SelectTrigger>
                            <SelectContent>
                                {subCategories.map((sub) => (
                                    <SelectItem key={sub} value={sub}>
                                        {sub}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add Product
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
