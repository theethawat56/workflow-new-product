import { withAuth } from "next-auth/middleware"
export default withAuth

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/products/:path*",
        "/api/products/:path*"
    ]
}
