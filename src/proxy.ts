import { withAuth } from "next-auth/middleware"

// Next.js 16+: file convention renamed middleware → proxy
export default withAuth

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/products/:path*",
        "/api/products/:path*",
    ],
}
