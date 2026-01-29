"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { productSchema, roleAssignmentSchema } from "@/lib/validations/product"
import { createProductAction } from "@/app/actions/product"
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

// Combine schemas for the full form? Or keep separate steps?
// Ideally single form with steps.
const combinedSchema = productSchema.merge(roleAssignmentSchema)
type FormValues = z.infer<typeof combinedSchema>

interface Props {
    users: any[]
    roleDefaults: any[]
}

export function NewProductForm({ users, roleDefaults }: Props) {
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
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
        resolver: zodResolver(combinedSchema),
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
            activate: false,
            assignments: defaultAssignments
        },
        mode: "onChange"
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

    const subCategories = selectedCategory ? PRODUCT_CATEGORIES[selectedCategory] || [] : []

    const onSubmit = async (data: FormValues) => {
        setIsSubmitting(true)
        try {
            // Split data back
            const productData = {
                sku_code: data.sku_code,
                product_name: data.product_name,
                category: data.category,
                sub_category: data.sub_category,
                launch_month: data.launch_month,
                go_live_date: data.go_live_date,
                sales_channel: data.sales_channel,
                cost: data.cost,
                price: data.price,
                activate: data.activate
            }
            const roleData = {
                assignments: data.assignments
            }

            const res = await createProductAction(productData, roleData)
            if (res && !res.success) {
                alert("Error: " + res.message)
                setIsSubmitting(false)
            } else if (res && res.success) {
                // Success - Client side redirect
                router.push("/products")
            }
        } catch (error: any) {
            console.error(error)
            alert("Failed to create product: " + (error.message || "Unknown error"))
            setIsSubmitting(false)
        }
    }

    const nextStep = async () => {
        // Validate current step fields
        let valid = false
        if (step === 1) {
            valid = await form.trigger([
                "sku_code", "product_name", "category", "sub_category",
                "launch_month", "go_live_date", "sales_channel", "cost", "price"
            ])
        } else if (step === 2) {
            valid = await form.trigger(["assignments"])
        }

        if (valid) setStep(s => s + 1)
    }

    const prevStep = () => setStep(s => s - 1)

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Stepper Indicator */}
                <div className="flex items-center space-x-4 mb-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`flex items-center ${step >= i ? 'text-primary' : 'text-muted-foreground'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= i ? 'border-primary bg-primary text-primary-foreground' : 'border-current'}`}>
                                {i}
                            </div>
                            <span className="ml-2 font-medium">
                                {i === 1 ? 'Product Info' : i === 2 ? 'Roles' : 'Confirm'}
                            </span>
                            {i < 3 && <div className="w-12 h-px bg-border mx-4" />}
                        </div>
                    ))}
                </div>

                {step === 1 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Product Information</CardTitle>
                            <CardDescription>Enter the core details for the new product.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                            <FormField control={form.control} name="sku_code" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>SKU Code</FormLabel>
                                    <FormControl><Input placeholder="PRD-001" {...field} /></FormControl>
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

                            {/* Category Field */}
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

                            {/* Sub-Category Field */}
                            <FormField control={form.control} name="sub_category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sub-Category</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        disabled={!selectedCategory || subCategories.length === 0}
                                        value={field.value} // Controlled to allow reset
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
                        </CardContent>
                        <CardFooter className="justify-end">
                            <Button type="button" onClick={nextStep}>Next: Role Assignment</Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 2 && (
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
                            <Button type="button" variant="outline" onClick={prevStep}>Back</Button>
                            <Button type="button" onClick={nextStep}>Next: Confirm</Button>
                        </CardFooter>
                    </Card>
                )}

                {step === 3 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Review & Activate</CardTitle>
                            <CardDescription>Review details and decide whether to activate the workflow immediately.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm border p-4 rounded-md">
                                <div><strong>SKU:</strong> {form.getValues("sku_code")}</div>
                                <div><strong>Name:</strong> {form.getValues("product_name")}</div>
                                <div><strong>Category:</strong> {form.getValues("category")}</div>
                                <div><strong>Sub-Category:</strong> {form.getValues("sub_category")}</div>
                                <div><strong>Live Date:</strong> {form.getValues("go_live_date")}</div>
                                <div><strong>Cost:</strong> {form.getValues("cost")}</div>
                                <div><strong>Price:</strong> {form.getValues("price")}</div>
                            </div>

                            <FormField control={form.control} name="activate" render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                            Activate Workflow Logic
                                        </FormLabel>
                                        <FormDescription>
                                            If checked, initial tasks will be generated based on the "General Launch" template.
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )} />
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button type="button" variant="outline" onClick={prevStep}>Back</Button>
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
