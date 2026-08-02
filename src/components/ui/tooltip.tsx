"use client"
import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "../../lib/utils"
const TooltipProvider = ({ children }: { children: React.ReactNode; delayDuration?: number }) => <>{children}</>

type TooltipContextValue = {
	open: boolean
	triggerRect: DOMRect | null
}

const TooltipContext = React.createContext<TooltipContextValue>({
	open: false,
	triggerRect: null,
})

const Tooltip = ({ children }: { children: React.ReactNode }) => {
	const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null)
	const [open, setOpen] = React.useState(false)

	return (
		<TooltipContext.Provider value={{ open, triggerRect }}>
			<span
				className="inline-flex"
				onMouseEnter={(event) => {
					setTriggerRect(event.currentTarget.getBoundingClientRect())
					setOpen(true)
				}}
				onMouseLeave={() => setOpen(false)}
			>
				{children}
			</span>
		</TooltipContext.Provider>
	)
}

const TooltipTrigger = ({ asChild, children, ...props }: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) => { const child = children as React.ReactElement; return asChild ? React.cloneElement(child, { ...props, className: cn(props.className, (child.props as { className?: string }).className) }) : <span {...props}>{children}</span> }

const TooltipContent = ({ className, side = "top", sideOffset = 8, ...props }: React.HTMLAttributes<HTMLDivElement> & { side?: string; sideOffset?: number }) => {
	const { open, triggerRect } = React.useContext(TooltipContext)

	if (!open || !triggerRect || typeof document === "undefined") return null

	const isRight = side === "right"
	const style: React.CSSProperties = isRight
		? { left: triggerRect.right + sideOffset, top: triggerRect.top + triggerRect.height / 2, transform: "translateY(-50%)" }
		: { left: triggerRect.left + triggerRect.width / 2, top: triggerRect.top - sideOffset, transform: "translate(-50%, -100%)" }

	return createPortal(
		<div
			className={cn("pointer-events-none fixed z-[100] whitespace-nowrap rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md", className)}
			style={style}
			{...props}
		/>,
		document.body,
	)
}
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }