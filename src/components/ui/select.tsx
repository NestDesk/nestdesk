"use client"
import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"
type SelectState = { value?: string; setValue: (value: string) => void }
const SelectContext = React.createContext<SelectState | null>(null)
const Select = ({ value, defaultValue, onValueChange, disabled, children }: { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; disabled?: boolean; children: React.ReactNode }) => { const [internal, setInternal] = React.useState(defaultValue); const current = value ?? internal; const setValue = (next: string) => { if (value === undefined) setInternal(next); onValueChange?.(next) }; return <fieldset disabled={disabled} className="contents"><SelectContext.Provider value={{ value: current, setValue }}>{children}</SelectContext.Provider></fieldset> }
const SelectGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>
const SelectValue = ({ placeholder }: { placeholder?: string }) => { const state = React.useContext(SelectContext); return <span>{state?.value || placeholder}</span> }
const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, children, ...props }, ref) => <button ref={ref} type="button" className={cn("flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm", className)} {...props}>{children}<ChevronDown className="h-4 w-4 opacity-50" /></button>)
SelectTrigger.displayName = "SelectTrigger"
const SelectContent = ({ className, children }: React.HTMLAttributes<HTMLDivElement> & { position?: string }) => <div className={cn("z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)}>{children}</div>
const SelectItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(({ className, value, children, ...props }, ref) => { const state = React.useContext(SelectContext); return <div ref={ref} role="option" aria-selected={state?.value === value} onClick={() => state?.setValue(value)} className={cn("relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm hover:bg-accent", className)} {...props}>{children}</div> })
SelectItem.displayName = "SelectItem"
const SelectLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />
const SelectSeparator = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
const SelectScrollUpButton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={className} {...props} />; const SelectScrollDownButton = SelectScrollUpButton
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton }