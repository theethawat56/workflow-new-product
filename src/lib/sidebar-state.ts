/** Shared sidebar collapse flag (desktop). Sync via localStorage + CustomEvent. */

export const SIDEBAR_OPEN_KEY = "launchflow-sidebar-open"
export const SIDEBAR_CHANGE_EVENT = "launchflow-sidebar-change"

export function readSidebarOpen(): boolean {
    if (typeof window === "undefined") return true
    try {
        return localStorage.getItem(SIDEBAR_OPEN_KEY) !== "0"
    } catch {
        return true
    }
}

export function writeSidebarOpen(open: boolean) {
    if (typeof window === "undefined") return
    try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, open ? "1" : "0")
        window.dispatchEvent(
            new CustomEvent(SIDEBAR_CHANGE_EVENT, { detail: { open } }),
        )
    } catch {
        /* ignore */
    }
}

export function toggleSidebarOpen(): boolean {
    const next = !readSidebarOpen()
    writeSidebarOpen(next)
    return next
}
