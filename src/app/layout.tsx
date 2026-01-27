import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GVP Student Management System",
  description: "Manage student attendance and records",
  manifest: "/manifest.json",
  icons: {
    icon: "/gvp-logo.jpg",
    shortcut: "/gvp-logo.jpg",
    apple: "/gvp-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} relative min-h-screen flex flex-col`} suppressHydrationWarning>
        <Providers>
          {/* Watermark */}
          <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none opacity-5">
            {/* Using standard img for external URL without config issues, or Next Image if domain allowlisted. 
                 Since I can't easily change next.config.js specifically for this domain without checking, 
                 and user gave a direct URL, I'll use a regular img tag or a div with background. 
                 A centered img is requested. "watermark for the whole site". 
                 Usually means a background logo. */}
            <img
              src="https://gvpcdpgc.edu.in/gvplogo.jpg"
              alt="Watermark"
              className="w-1/2 max-w-lg object-contain"
            />
          </div>

          <div className="relative z-10 flex flex-col flex-grow pt-16">
            <Navbar />
            <main className="container mx-auto flex-grow py-8 px-4">{children}</main>

            <footer className="mt-auto border-t border-slate-200 bg-white/80 py-6 text-center text-sm text-slate-600 backdrop-blur-sm">
              <p>Created by <span className="font-semibold text-slate-900">Saran Neralla</span>, Department of CSE, GVPCDPGC(A)</p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
