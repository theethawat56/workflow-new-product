import NextAuth, { NextAuthOptions, User } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { findOne } from "@/lib/db/adapter"
import { findUser } from "@/lib/workspace/auth-checks"

// Extend built-in types
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
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
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

                // specific findOne implementation for password check
                // We use findOne from adapter which returns the raw row including password
                // cast to any because our User type in schema might not have been updating strictly in all places yet
                // but we know it has password from schema.ts
                const user = await findOne<any>("users", "email", credentials.email)

                if (!user) {
                    console.log("[NextAuth] User not found:", credentials.email)
                    return null
                }

                if (!user.password) {
                    console.log("[NextAuth] User has no password (maybe Google auth only):", credentials.email)
                    return null
                }

                const isValid = await compare(credentials.password, user.password)

                if (!isValid) {
                    console.log("[NextAuth] Invalid password for:", credentials.email)
                    return null
                }

                // Check active status - string "TRUE" in sheets usually
                // In adapter findOne it returns the raw value.
                // update: in schema.ts active is mapped.
                // let's check parse.
                // Actually findOne returns the raw object with keys matching headers.
                // In schema.ts: active
                // In sheets it might be "TRUE" or true depending on how it was saved.
                // In user.ts createUserAction saves boolean true.
                // But sheets API might return it as string "TRUE".
                // Let's being safe.
                const isActive = String(user.active).toUpperCase() === 'TRUE'

                if (!isActive) {
                    console.log("[NextAuth] User inactive:", credentials.email)
                    throw new Error("User is not active")
                }

                console.log("[NextAuth] Authorized credentials for:", credentials.email)

                return {
                    id: user.email,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                }
            }
        })
    ],
    callbacks: {
        async signIn({ user, account }) {
            console.log("[NextAuth] SignIn Attempt:", user.email)

            // Allow Credentials login to bypass the sheetUser check if we just verified them in authorize
            if (account?.provider === "credentials") {
                return true
            }

            if (!user.email) {
                console.log("[NextAuth] No email provided")
                return false
            }

            try {
                // Gatekeeper: Check if user exists and is active in Sheets
                console.log("[NextAuth] Checking findUser for:", user.email)
                const sheetUser = await findUser(user.email)
                console.log("[NextAuth] findUser result:", JSON.stringify(sheetUser))

                if (!sheetUser || !sheetUser.active) {
                    console.log(`[NextAuth] Access denied for ${user.email}: User not found or inactive.`)
                    return false
                }

                // Attach role to user object for jwt callback
                user.role = sheetUser.role
                console.log("[NextAuth] Access granted. Role:", user.role)
                return true
            } catch (error) {
                console.error("[NextAuth] SignIn error:", error)
                return false
            }
        },
        async jwt({ token, user }) {
            // Initial sign in
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
    pages: {
        signIn: '/login', // Correct path
        error: '/auth/error', // Error code passed in query string as ?error=
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
