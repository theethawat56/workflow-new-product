"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Thin progress bar at the top of the viewport that animates
 * whenever the user navigates to a new route.
 */
export function NavigationProgress() {
    const pathname = usePathname()
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState(0)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const prevPathname = useRef(pathname)

    useEffect(() => {
        // Start loading when pathname changes
        if (prevPathname.current !== pathname) {
            prevPathname.current = pathname
            setLoading(true)
            setProgress(10)

            // Quick ramp to ~80% to simulate loading
            timerRef.current = setTimeout(() => setProgress(60), 100)
            timerRef.current = setTimeout(() => setProgress(80), 400)

            // Complete after a short delay
            const done = setTimeout(() => {
                setProgress(100)
                setTimeout(() => {
                    setLoading(false)
                    setProgress(0)
                }, 300)
            }, 600)

            return () => {
                if (timerRef.current) clearTimeout(timerRef.current)
                clearTimeout(done)
            }
        }
    }, [pathname])

    if (!loading && progress === 0) return null

    return (
        <div
            className={cn(
                "fixed top-0 left-0 right-0 z-[9999] h-[3px] transition-all duration-300",
                loading ? "opacity-100" : "opacity-0"
            )}
        >
            <div
                className="h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_8px_2px_hsl(var(--primary)/0.5)]"
                style={{ width: `${progress}%` }}
            />
        </div>
    )
}
