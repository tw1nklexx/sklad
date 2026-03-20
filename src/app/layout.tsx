import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { AppShell } from "@/components/app-shell"
import { SetupBanner } from "@/components/setup-banner"
import { isSupabaseConfigured } from "@/lib/supabase/admin"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
})

export const metadata: Metadata = {
  title: "Склад — остатки",
  description: "Внутренний учёт склада: остатки, списание по тексту, история.",
}

export const dynamic = "force-dynamic"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const showSetup = !isSupabaseConfigured()

  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {showSetup ? <SetupBanner /> : null}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
