import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PackageX, PackagePlus, CalendarDays, Timer } from "lucide-react"

interface ProductKPICardsProps {
    notLaunchedCount: number
    yearlyLaunchCount: number
    monthlyLaunchCount: number
    avgLaunchTimeDays: number
}

export function ProductKPICards({
    notLaunchedCount,
    yearlyLaunchCount,
    monthlyLaunchCount,
    avgLaunchTimeDays
}: ProductKPICardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Not Launched
                    </CardTitle>
                    <PackageX className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{notLaunchedCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Products in pipeline
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Launched This Year
                    </CardTitle>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{yearlyLaunchCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Total launched in {new Date().getFullYear()}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Added Monthly
                    </CardTitle>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{monthlyLaunchCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Products launched this month
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Avg Time Process
                    </CardTitle>
                    <Timer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{avgLaunchTimeDays} Days</div>
                    <p className="text-xs text-muted-foreground">
                        Average time to launch
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
