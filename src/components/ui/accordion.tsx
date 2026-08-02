"use client"
import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

type AccordionState = { open: string[]; toggle: (value: string) => void }
const AccordionContext = React.createContext<AccordionState | null>(null)
const ItemContext = React.createContext<string | null>(null)
interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> { type?: "single" | "multiple"; collapsible?: boolean; defaultValue?: string | string[]; value?: string | string[]; onValueChange?: (value: any) => void }
const Accordion = ({ type = "single", collapsible = false, defaultValue, value, onValueChange, className, ...props }: AccordionProps) => {
  const multiple = type === "multiple"; const initial = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : []; const [internal, setInternal] = React.useState(initial); const open = value === undefined ? internal : Array.isArray(value) ? value : value ? [value] : []
  const toggle = (item: string) => { const next = open.includes(item) ? (collapsible || multiple ? open.filter((v) => v !== item) : open) : multiple ? [...open, item] : [item]; if (value === undefined) setInternal(next); onValueChange?.(multiple ? next : next[0] ?? "") }
  return <AccordionContext.Provider value={{ open, toggle }}><div className={className} {...props} /></AccordionContext.Provider>
}
const AccordionItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(({ className, value, ...props }, ref) => <ItemContext.Provider value={value}><div ref={ref} className={cn("border-b", className)} {...props} /></ItemContext.Provider>)
AccordionItem.displayName = "AccordionItem"
const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, children, ...props }, ref) => { const state = React.useContext(AccordionContext); const value = React.useContext(ItemContext); const open = !!value && !!state?.open.includes(value); return <button ref={ref} type="button" aria-expanded={open} onClick={() => value && state?.toggle(value)} className={cn("flex w-full flex-1 items-center justify-between py-4 font-medium transition-all hover:underline", className)} {...props}>{children}<ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} /></button> })
AccordionTrigger.displayName = "AccordionTrigger"
const AccordionContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => { const state = React.useContext(AccordionContext); const value = React.useContext(ItemContext); if (!value || !state?.open.includes(value)) return null; return <div ref={ref} role="region" className={cn("overflow-hidden text-sm", className)} {...props}><div className="pb-4 pt-0">{children}</div></div> })
AccordionContent.displayName = "AccordionContent"
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }