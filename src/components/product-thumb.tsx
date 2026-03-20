"use client"

import { ImageOffIcon } from "lucide-react"
import Image from "next/image"

import { cn } from "@/lib/utils"

export function ProductThumb({
  src,
  alt,
  size = 40,
  className,
}: {
  src: string | null | undefined
  alt: string
  size?: number
  className?: string
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <ImageOffIcon className="size-[40%] opacity-50" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-foreground/5",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-cover"
        unoptimized={src.startsWith("data:") || src.startsWith("/")}
      />
    </div>
  )
}
