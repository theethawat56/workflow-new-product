import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const ibmPlexThai = IBM_Plex_Sans_Thai({
  weight: ['400', '500', '600'],
  subsets: ['thai', 'latin'],
  variable: "--font-thai",
  display: 'swap',
});

import { IBM_Plex_Sans_Thai } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Product Launch Workflow",
  description: "Manage product launches with Google Sheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.variable, ibmPlexThai.variable, "min-h-screen bg-background font-sans antialiased text-foreground")}>
        <Providers>
          <div className="flex min-h-screen bg-background">
            <Sidebar />

            <div className="flex-1 flex flex-col min-w-0">
              {/* Navbar will become TopHeader inside pages or kept here if global */}
              <Navbar />
              <main className="flex-1 p-6 overflow-y-auto w-full max-w-7xl mx-auto">
                {children}
              </main>
            </div>

          </div>
        </Providers>
      </body>
    </html>
  );
}
