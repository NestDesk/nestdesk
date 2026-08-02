"use client"
import * as React from "react"
import { cn } from "../../lib/utils"
const TooltipProvider = ({ children }: { children: React.ReactNode; delayDuration?: number }) => <>{children}</>
const Tooltip = ({ children }: { children: React.ReactNode }) => <span className="group relative inline-flex">{children}</span>
const TooltipTrigger = ({ asChild, children, ...props }: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) => asChild ? React.cloneElement(children as React.ReactElement<any>, { ...props, className: cn(props.className, (children as React.ReactElement<any>).props.className) }) : <span {...props}>{children}</span>
const TooltipContent = ({ className, side, sideOffset, ...props }: React.HTMLAttributes<HTMLDivElement> & { side?: string; sideOffset?: number }) => <div className={cn("pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md group-hover:block", className)} {...props} />
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }