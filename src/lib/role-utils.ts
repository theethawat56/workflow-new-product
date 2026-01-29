"use client"

import { useSession } from "next-auth/react"

export function useUserRole() {
    const { data: session } = useSession()
    return session?.user?.role
}

export const RESTRICTED_ROLES_FOR_FINANCIALS = ['CS', 'AfterService']

export function shouldHideFinancials(role?: string) {
    return role && RESTRICTED_ROLES_FOR_FINANCIALS.includes(role)
}
