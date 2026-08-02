"use client"
import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "../../lib/utils"
type SheetState = { open: boolean; setOpen: (open: boolean) => void }
const SheetContext = React.createContext<SheetState | null>(null)
const Sheet = ({ open: controlled, defaultOpen = false, onOpenChange, children }: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) => { const [internal, setInternal] = React.useState(defaultOpen); const open = controlled ?? internal; const setOpen = (next: boolean) => { if (controlled === undefined) setInternal(next); onOpenChange?.(next) }; return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider> }
const SheetTrigger = ({ asChild, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => { const state = React.useContext(SheetContext); const onClick = () => state?.setOpen(true); return asChild ? React.cloneElement(children as React.ReactElement<any>, { ...props, onClick, className: cn(props.className, (children as React.ReactElement<any>).props.className) }) : <button type="button" {...props} onClick={onClick}>{children}</button> }
const SheetClose = ({ asChild, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => { const state = React.useContext(SheetContext); const onClick = () => state?.setOpen(false); return asChild ? React.cloneElement(children as React.ReactElement<any>, { ...props, onClick }) : <button type="button" {...props} onClick={onClick}>{children}</button> }
const SheetPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}
const SheetOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => <div ref={ref} className={cn("fixed inset-0 z-[60] bg-black/80", className)} {...props} />)
SheetOverlay.displayName = "SheetOverlay"
const SheetContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { side?: "top" | "bottom" | "left" | "right"; sheetTitle?: string; sheetDescription?: string; onCloseAutoFocus?: (event: any) => void }>(({ side = "right", className, children, sheetTitle, sheetDescription, onCloseAutoFocus, ...props }, ref) => { const state = React.useContext(SheetContext); if (!state?.open) return null; const placement = { top: "inset-x-0 top-0 border-b", bottom: "inset-x-0 bottom-0 border-t", left: "inset-y-0 left-0 h-full w-3/4 border-r", right: "inset-y-0 right-0 h-full w-3/4 border-l" }[side]; return <SheetPortal><SheetOverlay onClick={() => state.setOpen(false)} /><div ref={ref} role="dialog" aria-label={sheetTitle} aria-description={sheetDescription} onClick={(event) => event.stopPropagation()} className={cn("fixed z-[70] gap-4 bg-background p-6 shadow-lg sm:max-w-sm", placement, className)} {...props}>{children}</div></SheetPortal> })
SheetContent.displayName = "SheetContent"
const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => <h2 ref={ref} className={cn("text-lg font-semibold", className)} {...props} />)
const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />)
export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }