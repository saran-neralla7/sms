import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GVP Student Management System",
  description: "Enterprise Student Management and ERP System for GVP",
  // Next.js automatically maps src/app/manifest.ts, do NOT hardcode absolute path!
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png", // Safari/iOS specific touch icon
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GVP SMS",
  },
};

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const currentYearId = cookieStore.get("academic-year-id")?.value;

  // Fetch years for selector
  let years: { id: string; name: string; isCurrent: boolean }[] = [];
  try {
    const allYears = await prisma.academicYear.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, isCurrent: true } // Only select needed fields
    });
    years = allYears;
  } catch (error) {
    console.error("Failed to fetch academic years in layout:", error);
  }

  return (
    <html lang="en">
      <body className={`${inter.className} relative min-h-screen flex flex-col`} suppressHydrationWarning>
        <Providers>
          {/* Watermark */}
          <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none opacity-5">
            <img
              src="https://gvpcdpgc.edu.in/gvplogo.jpg"
              alt="Watermark"
              className="w-1/2 max-w-lg object-contain"
            />
          </div>

          <div className="relative z-10 flex flex-col flex-grow pt-16">
            <Navbar years={years} currentYearId={currentYearId} />
            <main className="flex-grow">{children}</main>

            <footer className="mt-auto border-t border-slate-200 bg-white/80 py-6 text-center text-sm text-slate-600 backdrop-blur-sm">
              <p>Designed and Developed by <span className="font-semibold text-slate-900">Saran Neralla</span>, Department of CSE, GVPCDPGC(A)</p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
