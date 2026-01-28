"use client"

import { useSession, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { USER_ROLES } from "@/lib/db/schema"
import { registerUserAction } from "@/app/actions/user"
import { getCurrentUser } from "@/lib/db/permissions"
// Note: getCurrentUser is server side only, we check valid user via server action or just trust flow. 
// Actually we should check if user already exists to redirect. 
// But client side we rely on session.

// Correct logic:
// 1. Check session. If no session, show Login button.
// 2. If session, show Form.
// 3. User submits form -> registerUserAction -> redirect to dashboard.

export default function RegisterPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    // Form State
    const [name, setName] = useState("")
    const [role, setRole] = useState("PM")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        if (session?.user?.name) {
            setName(session.user.name)
        }
    }, [session])

    const handleRegister = async () => {
        if (!session?.user?.email) return
        setLoading(true)
        setError("")

        try {
            const res = await registerUserAction({
                email: session.user.email,
                name: name || session.user.name,
                role: role
            })

            if (res.success) {
                // Force a hard navigation to refresh server components/permissions
                window.location.href = "/dashboard"
            } else {
                setError(res.message)
                setLoading(false)
            }
        } catch (e: any) {
            setError(e.message)
            setLoading(false)
        }
    }

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>
    }

    if (status === "unauthenticated") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Card className="w-[350px]">
                    <CardHeader>
                        <CardTitle>Welcome</CardTitle>
                        <CardDescription>Please sign in to continue.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => signIn("google")} className="w-full">
                            Sign in with Google
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <Card className="w-[400px]">
                <CardHeader>
                    <CardTitle>Complete Registration</CardTitle>
                    <CardDescription>
                        Confirm your details to access the dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input value={session?.user?.email || ""} disabled />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your Name"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Role</label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {USER_ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {r}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                </CardContent>
                <CardFooter>
                    <Button
                        onClick={handleRegister}
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? "Registering..." : "Complete Registration"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
