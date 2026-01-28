import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { findOne } from "@/lib/db/adapter"
import { compare } from "bcryptjs"

// Extends NextAuth types to include our custom properties
declare module "next-auth" {
    interface Session {
        user: {
            name?: string | null
            email?: string | null
            image?: string | null
            role?: string
        }
    }
    interface User {
        role?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                console.log("Login Attempt:", credentials.email)

                // 1. Fetch user from Sheet
                const user = await findOne<any>("users", "email", credentials.email)

                console.log("User Found:", user)

                if (!user) {
                    console.log("User not found in Sheet")
                    return null
                }

                // Check active status (handle string "TRUE"/"FALSE" from sheets)
                // Sheets often returns "TRUE" string for boolean columns
                const isActive = user.active === true || String(user.active).toUpperCase() === "TRUE"
                console.log("Is Active Check:", isActive, "Raw value:", user.active)

                if (!isActive) {
                    console.log("User is inactive")
                    throw new Error("Account is pending approval.")
                }

                // 2. Verify Password
                console.log("Verifying password...")
                const isValid = await compare(credentials.password, user.password || "")
                console.log("Password Valid:", isValid)

                if (!isValid) {
                    console.log("Invalid password")
                    return null
                }

                // 3. Admin Override Logic (Hardcoded)
                let role = user.role
                if (user.email === "theethawat56@gmail.com") {
                    role = "Admin"
                }

                return {
                    id: user.email,
                    email: user.email,
                    name: user.name,
                    role: role,
                }
            }
        })
    ],
    pages: {
        signIn: "/login",
        // signOut: "/auth/signout",
        // error: "/auth/error", // Error code passed in query string as ?error=
        // newUser: "/auth/new-user" // New users will be directed here on first sign in (leave the property out if not of interest)
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role
            }
            return session
        },
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
}
