
import { Sidebar } from "@/components/layout/Sidebar"
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader"

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Desktop Sidebar - Persistent */}
            <Sidebar className="hidden md:flex border-r border-border shrink-0" />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Global Header for Mobile/Desktop */}
                <WorkspaceHeader />

                <main className="flex-1 overflow-y-auto relative bg-background">
                    {children}
                </main>
            </div>
        </div>
    )
}
