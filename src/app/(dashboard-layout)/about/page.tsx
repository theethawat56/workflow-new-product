import Link from "next/link"
import {
    Rocket,
    LayoutDashboard,
    Package,
    Users,
    ShoppingCart,
    BarChart3,
    Settings,
    Database,
    FileText,
    Share2
} from "lucide-react"

export default function AboutPage() {
    const modules = [
        {
            title: "Executive Dashboard",
            description: "Real-time command center providing high-level insights into product pipeline health, team performance, and monthly launch metrics.",
            icon: LayoutDashboard,
            href: "/dashboard",
            color: "text-blue-500",
            bg: "bg-blue-50"
        },
        {
            title: "Launch Control",
            description: "The core engine for managing the product lifecycle. Orchestrate every stage of a product launch, from initial concept to market release.",
            icon: Rocket,
            href: "/dashboard/launch",
            color: "text-purple-500",
            bg: "bg-purple-50"
        },
        {
            title: "Sales Analytics",
            description: "Deep dive into sales performance metrics. Analyze revenue trends, monitor product uptake, and forecast future growth.",
            icon: BarChart3,
            href: "/dashboard/sales",
            color: "text-green-500",
            bg: "bg-green-50"
        },
        {
            title: "Product Pipeline",
            description: "Comprehensive management of new product ideas and ongoing development. Track status and ensure all prerequisites are met.",
            icon: Package,
            href: "/products/pipeline",
            color: "text-orange-500",
            bg: "bg-orange-50"
        },
        {
            title: "Active Inventory",
            description: "Oversee products currently on sale. Monitor stock levels, manage SKU details, and track specific product attributes.",
            icon: ShoppingCart,
            href: "/products/on-sale",
            color: "text-indigo-500",
            bg: "bg-indigo-50"
        },
        {
            title: "Admin & Settings",
            description: "Centralized control for user management, role-based access control (RBAC), and system-wide configurations.",
            icon: Settings,
            href: "/admin",
            color: "text-slate-500",
            bg: "bg-slate-50"
        }
    ]

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-10 text-center md:text-left">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">System Overview</h1>
                <p className="text-lg text-gray-500 max-w-3xl">
                    Welcome to <span className="font-semibold text-primary">LaunchFlow</span>.
                    Use this directory to navigate the system and understand how your data connects.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                {modules.map((module) => {
                    const Icon = module.icon
                    return (
                        <Link
                            key={module.title}
                            href={module.href}
                            className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-6 overflow-hidden block"
                        >
                            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${module.color}`}>
                                <Icon className="w-24 h-24" />
                            </div>

                            <div className="relative z-10">
                                <div className={`w-12 h-12 rounded-lg ${module.bg} flex items-center justify-center mb-4`}>
                                    <Icon className={`w-6 h-6 ${module.color}`} />
                                </div>

                                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                                    {module.title}
                                </h3>

                                <p className="text-gray-500 leading-relaxed text-sm">
                                    {module.description}
                                </p>
                            </div>
                        </Link>
                    )
                })}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Share2 className="w-6 h-6 text-primary" />
                        Data Flow & Workflow
                    </h2>
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-orange-500 group-[.is-active]:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold">
                                1
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border border-gray-200 shadow-sm">
                                <div className="font-bold text-gray-900 mb-1">Ideation & Pipeline</div>
                                <div className="text-gray-500 text-sm">New products are added to the <span className="font-medium text-orange-600">Product Pipeline</span>. Data is stored in the <code>products</code> sheet.</div>
                            </div>
                        </div>
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-purple-500 group-[.is-active]:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold">
                                2
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border border-gray-200 shadow-sm">
                                <div className="font-bold text-gray-900 mb-1">Launch Execution</div>
                                <div className="text-gray-500 text-sm">Approved products move to <span className="font-medium text-purple-600">Launch Control</span>. Tasks are tracked and sync to <code>launched_products</code> sheet.</div>
                            </div>
                        </div>
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-green-500 group-[.is-active]:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold">
                                3
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border border-gray-200 shadow-sm">
                                <div className="font-bold text-gray-900 mb-1">Live Sales</div>
                                <div className="text-gray-500 text-sm">Once launched, items appear in <span className="font-medium text-indigo-600">Active Inventory</span> and <span className="font-medium text-green-600">Sales Analytics</span>.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Database className="w-6 h-6 text-primary" />
                        Data Connections
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                            <div className="p-2 bg-white rounded-full shrink-0">
                                <FileText className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-emerald-900">Google Sheets Integration</h3>
                                <p className="text-sm text-emerald-700 mt-1">
                                    The application database is purely powered by Google Sheets.
                                    All records are synced in real-time, allowing you to view raw data directly in Spreadsheets if needed.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
                            <div className="p-2 bg-white rounded-full shrink-0">
                                <Database className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-blue-900">Google Drive Storage</h3>
                                <p className="text-sm text-blue-700 mt-1">
                                    Product images, documentation, and assets are automatically uploaded and organized in your connected Google Drive folders.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="p-2 bg-white rounded-full shrink-0">
                                <Users className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">Google Workspace Auth</h3>
                                <p className="text-sm text-slate-700 mt-1">
                                    Secure sign-in is handled via Google OAuth, ensuring that only authorized team members within your workspace can access the system.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
