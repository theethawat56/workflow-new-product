import { NextResponse } from "next/server"
import { findOne } from "@/lib/db/adapter"
import { compare } from "bcryptjs"

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")
    const password = searchParams.get("password")

    if (!email || !password) {
        return NextResponse.json({ error: "Missing email or password" })
    }

    try {
        const user = await findOne<any>("users", "email", email)

        if (!user) {
            return NextResponse.json({
                status: "User Not Found",
                email
            })
        }

        const isActive = user.active === true || String(user.active).toUpperCase() === "TRUE"

        const isPasswordValid = await compare(password, user.password || "")

        return NextResponse.json({
            status: "User Found",
            userData: {
                ...user,
                // Don't show full hash for security in logs, but show first few chars
                password: user.password ? user.password.substring(0, 10) + "..." : "MISSING"
            },
            checks: {
                activeRaw: user.active,
                isActiveParsed: isActive,
                passwordProvided: password,
                passwordHashInDB: !!user.password,
                isPasswordValid: isPasswordValid
            }
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message })
    }
}
