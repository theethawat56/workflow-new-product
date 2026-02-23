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
import { ImageUploadZone } from "@/components/products/ImageUploadZone"

// Reuse product schema but omit activate since it's handled via status updates
const editFormSchema = productSchema.omit({ activate: true })
type FormValues = z.infer<typeof editFormSchema>

interface Props {
    product: any
}

export function EditProductDialog({ product }: Props) {
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Image upload state — null = no new file chosen (keep existing URL)
    const [productImage, setProductImage] = useState<File | null>(null)
    const [contactImage, setContactImage] = useState<File | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)

    // Helper to parse channels
    const parseChannels = (val: any): string[] => {
        if (Array.isArray(val)) return val
        if (typeof val === 'string' && val.trim().length > 0) {
            return val.split(',').map(s => s.trim())
        }
        return []
    }

    const form = useForm<FormValues>({
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
            fair_detail: product.fair_detail || "",
            date_of_fair: product.date_of_fair || "",
        }
    })

    // Reset form & image state when dialog opens
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
                fair_detail: product.fair_detail || "",
                date_of_fair: product.date_of_fair || "",
            })
            setProductImage(null)
            setContactImage(null)
            setUploadError(null)
        }
    }, [open, product, form])

    const selectedCategory = form.watch("category")
    const subCategories = selectedCategory ? PRODUCT_CATEGORIES[selectedCategory] || [] : []

    useEffect(() => {
        if (open && form.getValues("category") !== product.category) {
            form.setValue("sub_category", "")
        }
    }, [selectedCategory, open, form, product.category])

    // Upload a single image file and return its public URL
    const uploadImage = async (file: File, type: "product" | "contact"): Promise<string> => {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch(`/api/upload?type=${type}`, { method: "POST", body: formData })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || "Upload failed")
        return json.url as string
    }

    const onSubmit = async (data: FormValues) => {
        setIsSubmitting(true)
        setUploadError(null)
        try {
            // Upload new images if selected; keep existing URL otherwise
            let productImageUrl: string | undefined = undefined
            let contactImageUrl: string | undefined = undefined

            if (productImage) {
                productImageUrl = await uploadImage(productImage, "product")
            }
            if (contactImage) {
                contactImageUrl = await uploadImage(contactImage, "contact")
            }

            const res = await updateProductAction(product.product_id, {
                ...data,
                ...(productImageUrl !== undefined && { product_image_url: productImageUrl }),
                ...(contactImageUrl !== undefined && { contact_image_url: contactImageUrl }),
            })

            if (res.success) {
                setOpen(false)
            } else {
                alert("Failed to update product: " + res.message)
            }
        } catch (error: any) {
            console.error(error)
            setUploadError("Image upload failed: " + (error.message || "Unknown error"))
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
                                                render={({ field }) => (
                                                    <FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(item)}
                                                                onCheckedChange={(checked) => {
                                                                    return checked
                                                                        ? field.onChange([...field.value, item])
                                                                        : field.onChange(field.value?.filter((v: string) => v !== item))
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">{item}</FormLabel>
                                                    </FormItem>
                                                )}
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
                            <FormField control={form.control} name="fair_detail" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fair Detail</FormLabel>
                                    <FormControl><Input placeholder="Details..." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="date_of_fair" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date of Fair</FormLabel>
                                    <FormControl><Input type="date" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        {/* ── Media Images ── */}
                        <div className="space-y-3 pt-2 border-t">
                            <div>
                                <p className="text-sm font-semibold">Product Media</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Upload a new image to replace the existing one, or leave blank to keep current.
                                </p>
                            </div>
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Product Photo */}
                                <div className="space-y-2">
                                    {product.product_image_url && !productImage && (
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground font-medium">Current photo</p>
                                            <img
                                                src={product.product_image_url}
                                                alt="Current product"
                                                className="w-full max-h-32 object-contain rounded-lg border bg-muted/30"
                                            />
                                        </div>
                                    )}
                                    <ImageUploadZone
                                        label="📷 Product Photo"
                                        hint="PNG, JPG, WEBP · Max 10 MB"
                                        icon="image"
                                        accentColor="teal"
                                        value={productImage}
                                        onChange={setProductImage}
                                    />
                                </div>

                                {/* Contact / Name Card */}
                                <div className="space-y-2">
                                    {product.contact_image_url && !contactImage && (
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground font-medium">Current name card</p>
                                            <img
                                                src={product.contact_image_url}
                                                alt="Current contact"
                                                className="w-full max-h-32 object-contain rounded-lg border bg-muted/30"
                                            />
                                        </div>
                                    )}
                                    <ImageUploadZone
                                        label="🪪 Contact / Name Card"
                                        hint="PNG, JPG · Max 5 MB"
                                        icon="card"
                                        accentColor="violet"
                                        value={contactImage}
                                        onChange={setContactImage}
                                    />
                                </div>
                            </div>

                            {uploadError && (
                                <p className="text-sm text-destructive">{uploadError}</p>
                            )}
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
