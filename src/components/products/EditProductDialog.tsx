"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { productSchema } from "@/lib/validations/product"
import { updateProductAction } from "@/app/actions/product"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { CATEGORY_NAMES, PRODUCT_CATEGORIES } from "@/lib/constants"
import { Edit } from "lucide-react"

// Reuse product schema but omit activate since it's handled via status updates
const editFormSchema = productSchema.omit({ activate: true })
type FormValues = z.infer<typeof editFormSchema>

interface Props {
    product: any
}

export function EditProductDialog({ product }: Props) {
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Helper to parse channels
    const parseChannels = (val: any): string[] => {
        if (Array.isArray(val)) return val
        if (typeof val === 'string' && val.trim().length > 0) {
            return val.split(',').map(s => s.trim())
        }
        return []
    }

    // Parse existing values
    // We need to match the schema.
    const form = useForm<FormValues>({
        resolver: zodResolver(editFormSchema),
        defaultValues: {
            sku_code: product.sku_code || "",
            product_name: product.product_name || "",
            category: product.category || "",
            sub_category: product.sub_category || "",
            launch_month: product.launch_month || "JAN",
            go_live_date: product.go_live_date || "",
            sales_channel: parseChannels(product.sales_channel),
            cost: Number(product.cost) || 0,
            price: Number(product.price) || 0,
        }
    })

    // Update form when product changes or dialog opens
    useEffect(() => {
        if (open) {
            form.reset({
                sku_code: product.sku_code || "",
                product_name: product.product_name || "",
                category: product.category || "",
                sub_category: product.sub_category || "",
                launch_month: product.launch_month || "JAN",
                go_live_date: product.go_live_date || "",
                sales_channel: parseChannels(product.sales_channel),
                cost: Number(product.cost) || 0,
                price: Number(product.price) || 0,
            })
        }
    }, [open, product, form])


    const selectedCategory = form.watch("category")
    const subCategories = selectedCategory ? PRODUCT_CATEGORIES[selectedCategory] || [] : []

    // Reset sub_category when category changes (but only if user changes it interactively, 
    // we need to be careful not to reset on initial load. `useEffect` above handles initial load via reset.)
    // But if user changes category in UI, we want to clear sub.
    // The previous implementation used useEffect.
    useEffect(() => {
        if (open && form.getValues("category") !== product.category) {
            form.setValue("sub_category", "")
        }
    }, [selectedCategory, open, form, product.category])


    const onSubmit = async (data: FormValues) => {
        setIsSubmitting(true)
        try {
            const res = await updateProductAction(product.product_id, data)
            if (res.success) {
                setOpen(false)
            } else {
                alert("Failed to update product: " + res.message)
            }
        } catch (error) {
            console.error(error)
            alert("Failed to update product")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Product: {product.product_id}</DialogTitle>
                    <DialogDescription>
                        Update product details. Changing the Go Live Date will recalculate task dates.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <FormField control={form.control} name="sku_code" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>SKU Code</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="product_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Product Name</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {CATEGORY_NAMES.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="sub_category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sub-Category</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={!selectedCategory || subCategories.length === 0}
                                    >
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select sub-category" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {subCategories.map(sub => (
                                                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="launch_month" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Launch Month</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map(m => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="go_live_date" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Go Live Date</FormLabel>
                                    <FormControl><Input type="date" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="sales_channel" render={() => (
                                <FormItem>
                                    <div className="mb-4">
                                        <FormLabel className="text-base">Sales Channels</FormLabel>
                                        <FormDescription>
                                            Select all platforms where this product will be sold.
                                        </FormDescription>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {["Shopee", "Lazada", "Line", "Facebook"].map((item) => (
                                            <FormField
                                                key={item}
                                                control={form.control}
                                                name="sales_channel"
                                                render={({ field }) => {
                                                    return (
                                                        <FormItem
                                                            key={item}
                                                            className="flex flex-row items-start space-x-3 space-y-0"
                                                        >
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(item)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                            ? field.onChange([...field.value, item])
                                                                            : field.onChange(
                                                                                field.value?.filter(
                                                                                    (value: string) => value !== item
                                                                                )
                                                                            )
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">
                                                                {item}
                                                            </FormLabel>
                                                        </FormItem>
                                                    )
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="cost" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cost</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="price" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Price</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
