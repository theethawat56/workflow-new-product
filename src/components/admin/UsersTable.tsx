"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createUserAction, updateUserAction } from "@/app/actions/user"
import { USER_ROLES } from "@/lib/db/schema"

interface Props {
    users: any[]
}

export function UsersTable({ users }: Props) {
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [formData, setFormData] = useState({ email: "", name: "", role: "PM" })
    const [loading, setLoading] = useState(false)

    const handleCreate = async () => {
        setLoading(true)
        const res = await createUserAction(formData)
        if (!res.success) alert(res.message)
        setLoading(false)
        setIsAddOpen(false)
        setFormData({ email: "", name: "", role: "PM" })
    }

    const toggleActive = async (user: any) => {
        const newVal = user.active === "TRUE" ? "FALSE" : "TRUE" // Sheets boolean storage might be string
        // Actually schema adapter writes raw, usually sheets stores TRUE/FALSE boolean.
        // But findAll returns basic values.
        // Let's assume boolean or string "TRUE"/"FALSE".
        const current = user.active === true || user.active === "TRUE"
        await updateUserAction(user.email, { active: !current })
    }

    return (
        <div>
            <div className="mb-4 flex justify-end">
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild><Button>Add User</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <Input placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            <Input placeholder="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {USER_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleCreate} disabled={loading} className="w-full">Create</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Active</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user.email}>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>{user.name}</TableCell>
                                <TableCell>
                                    <Select
                                        defaultValue={user.role}
                                        onValueChange={async (val) => {
                                            const res = await updateUserAction(user.email, { role: val })
                                            if (!res.success) alert("Failed to update role: " + res.message)
                                        }}
                                    >
                                        <SelectTrigger className="w-[100px] h-8">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {USER_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>{user.active ? "Yes" : "No"}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => toggleActive(user)}>
                                        {user.active ? "Deactivate" : "Activate"}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
