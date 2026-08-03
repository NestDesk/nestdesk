"use client"

import * as React from "react"
import Image, { type ImageProps } from "next/image"
import { cn } from "../../lib/utils"

const Avatar = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
  ),
)
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ className, alt = "", width = 40, height = 40, ...props }, ref) => <Image ref={ref} alt={alt} width={width} height={height} className={cn("aspect-square h-full w-full", className)} {...props} />,
)
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)} {...props} />
  ),
)
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }