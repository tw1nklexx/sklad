"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const nav = [
  { href: "/", label: "Склад" },
  { href: "/history", label: "История" },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="min-h-full bg-muted/35">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 w-full max-w-7xl items-center px-5">
          <nav className="flex items-center gap-1">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl px-5 py-8">{children}</div>
    </div>
  )
}
