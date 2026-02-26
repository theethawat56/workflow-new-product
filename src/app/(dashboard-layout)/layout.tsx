import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { NavigationProgress } from "@/components/layout/NavigationProgress";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-background">
            <NavigationProgress />
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />
                <main className="flex-1 p-4 md:p-6 overflow-y-auto w-full max-w-7xl mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
