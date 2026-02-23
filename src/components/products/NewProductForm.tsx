"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { productSchema, roleAssignmentSchema } from "@/lib/validations/product"
import { createProductAction, generateSkuAction } from "@/app/actions/product"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { USER_ROLES } from "@/lib/db/schema"
import { useRouter } from "next/navigation"
import { CATEGORY_NAMES, PRODUCT_CATEGORIES } from "@/lib/constants"
import { ImageUploadZone } from "@/components/products/ImageUploadZone"
import { Check } from "lucide-react"

// Combine schemas for the full form
const combinedSchema = productSchema.merge(roleAssignmentSchema)
type FormValues = z.infer<typeof combinedSchema>

interface Props {
    users: any[]
    roleDefaults: any[]
}

const STEPS = [
    { id: 1, label: "Media Upload" },
    { id: 2, label: "Product Info" },
    { id: 3, label: "Roles" },
    { id: 4, label: "Confirm" },
]

export function NewProductForm({ users, roleDefaults }: Props) {
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [productImage, setProductImage] = useState<File | null>(null)
    const [contactImage, setContactImage] = useState<File | null>(null)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [skuLoading, setSkuLoading] = useState(true)
    const router = useRouter()

    // Initialize defaults for role assignments
    const defaultAssignments = USER_ROLES.map(role => {
        const def = roleDefaults.find(r => r.role === role)
        return {
            role,
            owner_email: def?.owner_email || "",
            note: ""
        }
    })

    const form = useForm<FormValues>({
        defaultValues: {
            sku_code: "",
            product_name: "",
            category: "",
            sub_category: "",
            launch_month: "JAN",
            go_live_date: "",
            sales_channel: [],
            cost: 0,
            price: 0,
            fair_detail: "",
            date_of_fair: "",
            product_image_url: "",
            contact_image_url: "",
            activate: false,
            assignments: defaultAssignments
        },
    })

    const { fields } = useFieldArray({
        control: form.control,
        name: "assignments"
    })

    const selectedCategory = form.watch("category")

    // Reset sub_category when category changes
    useEffect(() => {
        form.setValue("sub_category", "")
    }, [selectedCategory, form])

    // Auto-generate SKU code on mount
    useEffect(() => {
        setSkuLoading(true)
        generateSkuAction()
            .then(sku => {
                form.setValue("sku_code", sku)
            })
            .catch(() => {
                // Leave blank so user can type manually
            })
            .finally(() => setSkuLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const subCategories = selectedCategory ? PRODUCT_CATEGORIES[selectedCategory] || [] : []

    // Upload a single image file and return its URL
    const uploadImage = async (file: File, type: "product" | "contact"): Promise<string> => {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch(`/api/upload?type=${type}`, {
            method: "POST",
            body: formData,
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || "Upload failed")
        return json.url as string
    }

    const onSubmit = async (data: FormValues) => {
        setIsSubmitting(true)
        setUploadError(null)

        try {
            // Upload images first if selected
            let productImageUrl = ""
            let contactImageUrl = ""

            if (productImage) {
                productImageUrl = await uploadImage(productImage, "product")
            }
            if (contactImage) {
                contactImageUrl = await uploadImage(contactImage, "contact")
            }

            const productData = {
                sku_code: data.sku_code,
                product_name: data.product_name,
                category: data.category,
                sub_category: data.sub_category,
                launch_month: data.launch_month,
                go_live_date: `'${data.go_live_date}`,
                sales_channel: data.sales_channel,
                cost: data.cost,
                price: data.price,
                fair_detail: data.fair_detail,
                date_of_fair: `'${data.date_of_fair}`,
                product_image_url: productImageUrl,
                contact_image_url: contactImageUrl,
                activate: data.activate
            }
            const roleData = { assignments: data.assignments }

            const res = await createProductAction(productData, roleData)
            if (res && !res.success) {
                alert("Error: " + res.message)
                setIsSubmitting(false)
            } else if (res && res.success) {
                router.push("/products")
            }
        } catch (error: any) {
            console.error(error)
            setUploadError("Failed to upload image: " + (error.message || "Unknown error"))
            setIsSubmitting(false)
        }
    }

    const nextStep = async () => {
        let valid = false
        if (step === 1) {
            // Media upload is optional — always allow proceeding
            valid = true
        } else if (step === 2) {
            // Product Info — no required validation, always allow proceeding
            valid = true
        } else if (step === 3) {
            valid = await form.trigger(["assignments"])
        }

        if (valid) setStep(s => s + 1)
    }

    const prevStep = () => setStep(s => s - 1)

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                {/* ── Stepper Indicator ── */}
                <div className="flex items-center">
                    {STEPS.map((s, idx) => (
                        <div key={s.id} className="flex items-center">
                            {/* Circle */}
                            <div className={`flex items-center justify-center w-9 h-9 rounded-full border-2 font-semibold text-sm transition-colors
                                ${step > s.id
                                    ? "border-emerald-500 bg-emerald-500 text-white"
                                    : step === s.id
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-muted-foreground/30 text-muted-foreground"
                                }`}>
                                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                            </div>
                            {/* Label */}
                            <span className={`ml-2 text-sm font-medium whitespace-nowrap
                                ${step === s.id ? "text-foreground" : "text-muted-foreground"}`}>
                                {s.label}
                            </span>
                            {/* Connector line */}
                            {idx < STEPS.length - 1 && (
                                <div className={`w-12 h-px mx-4 transition-colors ${step > s.id ? "bg-emerald-500" : "bg-border"}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Step 1: Media Upload ── */}
                {step === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Product Information</CardTitle>
                            <CardDescription>Enter the core details for the new product.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                            <FormField control={form.control} name="sku_code" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>SKU Code</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                placeholder="Generating…"
                                                {...field}
                                                disabled={skuLoading}
                                                className={skuLoading ? "pr-8 text-muted-foreground" : ""}
                                            />
                                            {skuLoading && (
                                                <span className="absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                            )}
                                        </div>
                                    </FormControl>
                                    <FormDescription className="text-[11px]">
                                        {skuLoading ? "Generating SKU…" : "Auto-generated · you can edit if needed"}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="product_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Product Name</FormLabel>
                                    <FormControl><Input placeholder="Awesome Gadget" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Category */}
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                            {/* Sub-Category */}
                            <FormField control={form.control} name="sub_category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sub-Category</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        disabled={!selectedCategory || subCategories.length === 0}
                                        value={field.value}
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

                            {/* Launch Month */}
                            <FormField control={form.control} name="launch_month" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Launch Month</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                            {/* Go Live Date */}
                            <FormField control={form.control} name="go_live_date" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Go Live Date</FormLabel>
                                    <FormControl><Input type="date" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Sales Channels */}
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

                            {/* Cost */}
                            <FormField control={form.control} name="cost" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cost</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Price */}
                            <FormField control={form.control} name="price" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Price</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Fair Detail */}
                            <FormField control={form.control} name="fair_detail" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fair Detail</FormLabel>
                                    <FormControl><Input placeholder="Details about the fair..." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Date of Fair */}
                            <FormField control={form.control} name="date_of_fair" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date of Fair</FormLabel>
                                    <FormControl><Input type="date" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                        <CardFooter className="justify-end">
                            <Button type="button" onClick={nextStep}>Next: Product Info →</Button>
                        </CardFooter>
                    </Card>
                )}

                {/* ── Step 2: Product Information ── */}
                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Media Upload</CardTitle>
                            <CardDescription>
                                Upload a product photo and supplier contact / name card. Both are optional.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-8 md:grid-cols-2">
                                {/* Product Photo */}
                                <ImageUploadZone
                                    label="📷 Product Photo"
                                    hint="PNG, JPG, WEBP · Max 10 MB"
                                    icon="image"
                                    accentColor="teal"
                                    value={productImage}
                                    onChange={setProductImage}
                                />

                                {/* Contact / Name Card */}
                                <ImageUploadZone
                                    label="🪪 Contact / Name Card"
                                    hint="PNG, JPG · Max 5 MB — supplier or business card"
                                    icon="card"
                                    accentColor="violet"
                                    value={contactImage}
                                    onChange={setContactImage}
                                />
                            </div>

                            {uploadError && (
                                <p className="mt-4 text-sm text-destructive text-center">{uploadError}</p>
                            )}
                        </CardContent>
                        <CardFooter className="justify-end">
                            <Button type="button" onClick={nextStep}>Next: Product Info →</Button>
                        </CardFooter>
                    </Card>
                )}

                {/* ── Step 3: Role Assignments ── */}
                {step === 3 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Role Assignments</CardTitle>
                            <CardDescription>Assign owners for each role. Defaults are pre-filled.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Owner Email</TableHead>
                                        <TableHead>Note</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell className="font-medium">
                                                {field.role}
                                                <input type="hidden" {...form.register(`assignments.${index}.role`)} />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`assignments.${index}.owner_email`}
                                                    render={({ field }) => (
                                                        <FormItem className="mb-0">
                                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-8">
                                                                        <SelectValue placeholder="Select owner" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {users.map((user) => (
                                                                        <SelectItem key={user.email} value={user.email}>
                                                                            {user.name || user.email}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <FormField
                                                    control={form.control}
                                                    name={`assignments.${index}.note`}
                                                    render={({ field }) => (
                                                        <Input placeholder="Note..." {...field} />
                                                    )}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button type="button" variant="outline" onClick={prevStep}>← Back</Button>
                            <Button type="button" onClick={nextStep}>Next: Confirm →</Button>
                        </CardFooter>
                    </Card>
                )}

                {/* ── Step 4: Review & Confirm ── */}
                {step === 4 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Review &amp; Activate</CardTitle>
                            <CardDescription>Review details and decide whether to activate the workflow immediately.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Product details summary */}
                            <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-md">
                                <div><strong>SKU:</strong> {form.getValues("sku_code")}</div>
                                <div><strong>Name:</strong> {form.getValues("product_name")}</div>
                                <div><strong>Category:</strong> {form.getValues("category")}</div>
                                <div><strong>Sub-Category:</strong> {form.getValues("sub_category")}</div>
                                <div><strong>Live Date:</strong> {form.getValues("go_live_date")}</div>
                                <div><strong>Launch Month:</strong> {form.getValues("launch_month")}</div>
                                <div><strong>Cost:</strong> {form.getValues("cost")}</div>
                                <div><strong>Price:</strong> {form.getValues("price")}</div>
                                <div><strong>Fair Detail:</strong> {form.getValues("fair_detail")}</div>
                                <div><strong>Date of Fair:</strong> {form.getValues("date_of_fair")}</div>
                            </div>

                            {/* Image Previews */}
                            {(productImage || contactImage) && (
                                <div>
                                    <p className="text-sm font-semibold mb-3">Uploaded Media</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {productImage && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground font-medium">📷 Product Photo</p>
                                                <img
                                                    src={URL.createObjectURL(productImage)}
                                                    alt="Product"
                                                    className="w-full max-h-40 object-contain rounded-lg border bg-muted/30"
                                                />
                                                <p className="text-xs text-muted-foreground truncate">{productImage.name}</p>
                                            </div>
                                        )}
                                        {contactImage && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground font-medium">🪪 Contact / Name Card</p>
                                                <img
                                                    src={URL.createObjectURL(contactImage)}
                                                    alt="Contact"
                                                    className="w-full max-h-40 object-contain rounded-lg border bg-muted/30"
                                                />
                                                <p className="text-xs text-muted-foreground truncate">{contactImage.name}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Activate checkbox */}
                            <FormField control={form.control} name="activate" render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Activate Workflow Logic</FormLabel>
                                        <FormDescription>
                                            If checked, initial tasks will be generated based on the &quot;General Launch&quot; template.
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )} />

                            {uploadError && (
                                <p className="text-sm text-destructive">{uploadError}</p>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button type="button" variant="outline" onClick={prevStep}>← Back</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Creating..." : "Create Product"}
                            </Button>
                        </CardFooter>
                    </Card>
                )}
            </form>
        </Form>
    )
}
