
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, CheckSquare, MessageSquare, LayoutDashboard } from "lucide-react"
import Link from "next/link"

export default async function WorkspaceOverviewPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin")
    }

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Overview</h2>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Link href="/workspace/products">
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Products</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Manage</div>
                            <p className="text-xs text-muted-foreground">
                                View and edit product details
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/workspace/tasks">
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
                            <CheckSquare className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Track</div>
                            <p className="text-xs text-muted-foreground">
                                Manage pending tasks
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/workspace/assistant">
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Assistant</CardTitle>
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Chat</div>
                            <p className="text-xs text-muted-foreground">
                                Get help from AI
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/dashboard">
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-dashed">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Main Dashboard</CardTitle>
                            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Exit</div>
                            <p className="text-xs text-muted-foreground">
                                Return to main system
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Future: Add Recent Activity or Quick Stats here */}
        </div>
    )
}
