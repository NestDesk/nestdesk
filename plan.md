# NestDesk — Initial Setup Plan

## Tech Stack

| Layer           | Tool                    |
| --------------- | ----------------------- |
| Framework       | Next.js 14 (App Router) |
| Language        | TypeScript 5.x          |
| Styling         | Tailwind CSS 3.x        |
| Components      | Shadcn/UI               |
| Icons           | Lucide React            |
| Theme           | next-themes             |
| Forms           | React Hook Form + Zod   |
| Toast           | Sonner                  |
| Database / Auth | Supabase                |
| Linting         | ESLint                  |

---

## Folder Structure

```
nestdesk/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/              # Shadcn auto-generated
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── DashboardShell.tsx
│   │   │   ├── MobileNav.tsx
│   │   │   └── ThemeToggle.tsx
│   │   └── shared/
│   │       └── Logo.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── utils.ts
│   ├── hooks/
│   │   └── use-mobile.ts
│   ├── providers/
│   │   └── ThemeProvider.tsx
│   ├── types/
│   │   └── index.ts
│   └── styles/
├── .env.local
├── .env.example
├── .gitignore
├── components.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Step 1 — Create Project

```bash
npx create-next-app@14 nestdesk \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git

cd nestdesk
```

---

## Step 2 — Install Dependencies

```bash
# Shadcn init (run first — generates components.json and updates globals.css)
npx shadcn@latest init

# Utilities
npm install clsx tailwind-merge class-variance-authority

# Icons
npm install lucide-react

# Theme
npm install next-themes

# Forms + Validation
npm install react-hook-form zod @hookform/resolvers

# Toast
npm install sonner

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Tailwind animate plugin
npm install tailwindcss-animate
```

---

## Step 3 — Shadcn Init Answers

When `npx shadcn@latest init` runs:

| Prompt               | Answer                |
| -------------------- | --------------------- |
| Style                | Default               |
| Base color           | Slate                 |
| CSS variables        | Yes                   |
| Global CSS path      | `src/app/globals.css` |
| Tailwind config path | `tailwind.config.ts`  |
| Components alias     | `@/components/ui`     |
| Utils alias          | `@/lib/utils`         |
| Server components    | Yes                   |

Add baseline components:

```bash
npx shadcn@latest add button card input label badge avatar \
  dropdown-menu separator sheet skeleton tooltip
```

---

## Step 4 — `src/lib/utils.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Step 5 — `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

---

## Step 6 — `src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;

    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;

    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;

    /* Primary — indigo SaaS feel */
    --primary: 238 84% 60%;
    --primary-foreground: 0 0% 100%;

    --secondary: 210 40% 96%;
    --secondary-foreground: 222 47% 11%;

    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;

    --accent: 210 40% 96%;
    --accent-foreground: 222 47% 11%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 238 84% 60%;

    /* Sidebar — dark always */
    --sidebar-background: 222 47% 11%;
    --sidebar-foreground: 210 40% 80%;
    --sidebar-border: 217 33% 17%;
    --sidebar-accent: 217 33% 17%;
    --sidebar-accent-foreground: 0 0% 100%;

    --radius: 0.75rem;
  }

  .dark {
    --background: 222 47% 7%;
    --foreground: 213 31% 91%;

    --card: 222 47% 10%;
    --card-foreground: 213 31% 91%;

    --popover: 222 47% 10%;
    --popover-foreground: 213 31% 91%;

    --primary: 238 84% 65%;
    --primary-foreground: 0 0% 100%;

    --secondary: 217 33% 17%;
    --secondary-foreground: 213 31% 91%;

    --muted: 217 33% 17%;
    --muted-foreground: 215 16% 57%;

    --accent: 217 33% 17%;
    --accent-foreground: 213 31% 91%;

    --destructive: 0 63% 50%;
    --destructive-foreground: 0 0% 100%;

    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 238 84% 65%;

    --sidebar-background: 222 47% 5%;
    --sidebar-foreground: 210 40% 80%;
    --sidebar-border: 217 33% 12%;
    --sidebar-accent: 217 33% 12%;
    --sidebar-accent-foreground: 0 0% 100%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-feature-settings:
      "rlig" 1,
      "calt" 1;
  }
}
```

---

## Step 7 — `src/providers/ThemeProvider.tsx`

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

---

## Step 8 — `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: "NestDesk", template: "%s — NestDesk" },
  description: "Modern hostel management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

> `suppressHydrationWarning` on `<html>` and `attribute="class"` on ThemeProvider prevent hydration mismatch.

---

## Step 9 — Supabase Setup

`src/lib/supabase/client.ts`

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`src/lib/supabase/server.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}
```

`.env.local` (never commit) — **DEV values are now filled in**

```env
# ── DEV environment (nestdesk-dev Supabase project) ──────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://qviwaspbhijvchmmbub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev anon key>
SUPABASE_SERVICE_ROLE_KEY=<dev service role key>
```

`.env.example` (committed — no real values, documents both environments)

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_DEV_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_DEV_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_DEV_SERVICE_ROLE_KEY
```

> `client.ts` and `admin.ts` now call `validateSupabaseEnv()` / `validateServiceRoleKey()` from `env-check.ts` for early, readable startup errors.

---

## Step 10 — Layout Components

### `src/components/layout/ThemeToggle.tsx`

```tsx
"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### `src/components/layout/TopBar.tsx`

```tsx
import { ThemeToggle } from "./ThemeToggle";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileNav } from "./MobileNav";

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        {title && <h1 className="text-sm font-semibold text-foreground">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Bell className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">
            ND
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
```

### `src/components/layout/Sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Bell,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Hostels", href: "/hostels", icon: Building2 },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Notices", href: "/notices", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-sidebar-foreground">NestDesk</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            AK
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              Ahmad Khan
            </p>
            <p className="truncate text-xs text-sidebar-foreground/50">
              owner@email.com
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

### `src/components/layout/MobileNav.tsx`

```tsx
"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden rounded-xl">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}
```

### `src/components/layout/DashboardShell.tsx`

```tsx
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
}

export function DashboardShell({ children, title }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

---

## Step 11 — Pages

### `src/app/page.tsx` — Landing

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, Shield, Zap, Users } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
          <Building2 className="h-7 w-7 text-white" />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Manage your hostel
            <br />
            <span className="text-primary">the modern way</span>
          </h1>
          <p className="max-w-md text-muted-foreground">
            Tenants, rooms, payments, and compliance — all in one clean dashboard.
          </p>
        </div>

        <div className="flex gap-3">
          <Link href="/login">
            <Button size="lg" className="rounded-xl px-8">
              Get Started
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="rounded-xl px-8">
              View Demo
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" /> DPDP Act Compliant
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-primary" /> Razorpay Secured
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" /> Data stored in India
          </span>
        </div>
      </div>
    </main>
  );
}
```

### `src/app/(auth)/layout.tsx`

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}
```

### `src/app/(auth)/login/page.tsx`

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(_data: LoginForm) {
    try {
      // TODO: wire to Supabase auth in Week 1 Day 3
      await new Promise((r) => setTimeout(r, 1000));
      toast.success("Logged in successfully");
    } catch {
      toast.error("Invalid credentials");
    }
  }

  return (
    <Card className="w-full max-w-sm rounded-2xl shadow-lg">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Building2 className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your NestDesk account</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="rounded-xl"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="rounded-xl"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full rounded-xl"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

### `src/app/(dashboard)/layout.tsx`

```tsx
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
```

### `src/app/(dashboard)/dashboard/page.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CreditCard, TrendingUp } from "lucide-react";

const stats = [
  { label: "Total Tenants", value: "24", icon: Users, change: "+2 this month" },
  {
    label: "Occupied Rooms",
    value: "18 / 24",
    icon: Building2,
    change: "75% occupancy",
  },
  {
    label: "Rent Collected",
    value: "₹54,000",
    icon: CreditCard,
    change: "90% collected",
  },
  {
    label: "Monthly Revenue",
    value: "₹60,000",
    icon: TrendingUp,
    change: "+12% vs last",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-muted-foreground">Overview of your hostel business</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, change }) => (
          <Card key={label} className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Payment list — Week 4</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Room Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Room grid — Week 2</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Step 12 — `src/hooks/use-mobile.ts`

```ts
import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}
```

---

## Step 13 — `src/types/index.ts`

```ts
export type UserRole = "owner" | "tenant";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
```

---

## Step 14 — `tsconfig.json` — Verify Paths

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Step 15 — `.gitignore` — Verify These Lines Exist

```
.env.local
.env*.local
.next/
node_modules/
```

---

## Step 16 — Verify Setup

```bash
npm run dev        # visit localhost:3000
npm run lint       # must pass clean
npx tsc --noEmit   # must compile clean
```

Checklist:

- [ ] Landing page renders at `/`
- [ ] Login page at `/login` with Zod form validation
- [ ] Dashboard at `/dashboard` with sidebar + stat cards
- [ ] Light theme renders correctly
- [ ] Dark theme renders correctly
- [ ] System theme follows OS preference
- [ ] Theme toggle (Light / Dark / System) works in TopBar
- [ ] Sidebar active link highlights on current route
- [ ] Mobile sheet nav opens on small screens
- [ ] Sonner toast shows on login submit
- [ ] No hydration warnings in browser console
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` compiles without errors

---

## What Is NOT in This Phase

| Feature                        | Phase          |
| ------------------------------ | -------------- |
| Real Supabase Auth login       | Week 1 - Day 3 |
| Database schema + RLS          | Week 1 - Day 2 |
| Tenant management              | Week 2         |
| Document storage               | Week 2         |
| Payments + Razorpay            | Week 4         |
| Notifications (Resend / MSG91) | Week 5         |
| Subscriptions                  | Week 6         |
| Legal pages + compliance       | Week 7         |

---

---

# Implementation Progress Log

## ✅ Day 1 — Completed

### Hour 1 — Project Init

- [x] Next.js 14 project created (`nestdesk`)
- [x] Shadcn/UI + Radix UI installed and initialized
- [x] GitHub repository set up
- [x] `.gitignore` covers all `.env*` files — no secrets in Git
- [x] Pushed to GitHub on branch `initial` (dev branch)

### Hour 2 — Supabase + Security

- [x] Supabase DEV project created → ref: `qviwaspbhijvchmmbub`
- [x] `.env.local` configured with real DEV credentials
- [x] Security dependencies installed:
  ```bash
  npm install helmet rate-limiter-flexible
  ```
  (`zod` was already installed from Shadcn init)
- [x] `src/lib/supabase/env-check.ts` created — validates env vars at startup with descriptive errors
- [x] `src/lib/supabase/client.ts` updated to use `validateSupabaseEnv()`
- [x] `src/lib/supabase/admin.ts` created — server-only admin client using `service_role` key
- [x] `.env.example` recreated documenting two-environment setup (safe to commit)

### Hour 3 — Deploy Prep ✅ Decisions finalised

- [x] Vercel deploy strategy decided (see Architecture Decisions below)
- [ ] Vercel project import + `initial` branch deployed
- [ ] Verify preview URL works (`nestdesk-git-initial-xxxx.vercel.app`)
- [ ] Production (`main` branch + `nestdesk.in`) set up when ready to launch

---

## 🏗️ Architecture Decisions Made

### Two-Environment Supabase Setup

| Environment | Supabase Project | Branch    | Domain                                 | Status        |
| ----------- | ---------------- | --------- | -------------------------------------- | ------------- |
| Dev         | `nestdesk-dev`   | `initial` | `nestdesk-git-initial-xxxx.vercel.app` | 🔧 Setting up |
| Production  | `nestdesk-prod`  | `main`    | `nestdesk.in` + `www.nestdesk.in`      | 🔧 Setting up |

> Dev uses the free auto-assigned Vercel preview URL. No `dev.nestdesk.in` subdomain needed.

### Domain & DNS (Hostinger) — Production

Domain `nestdesk.in` is registered on **Hostinger**.

DNS records to add in Hostinger hPanel → DNS Records:

| Type  | Name  | Value                                 | TTL  |
| ----- | ----- | ------------------------------------- | ---- |
| A     | `@`   | `76.76.21.21`                         | 3600 |
| CNAME | `www` | `3d2beabc152efcdc.vercel-dns-017com.` | 3600 |

> Use the exact CNAME value shown in Vercel → Settings → Domains → `www.nestdesk.in` — it is project-specific.
> After adding, DNS propagates in 5–30 minutes. Click **Refresh** in Vercel to verify.

---

## 📋 Day 2 — Database Schema (SQL ready, not yet executed)

Run these three SQL steps in the **Supabase SQL Editor** of the DEV project.

### Step 1 — Core Tables

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Owners (one per Supabase auth user)
create table owners (
  id            uuid primary key default uuid_generate_v4(),
  auth_user_id  uuid unique not null references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text unique not null,
  phone         text,
  plan          text not null default 'free' check (plan in ('free','starter','pro','business','enterprise')),
  plan_expires_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Hostels
create table hostels (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references owners(id) on delete cascade,
  name        text not null,
  address     text,
  city        text,
  state       text,
  pincode     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Floors
create table floors (
  id          uuid primary key default uuid_generate_v4(),
  hostel_id   uuid not null references hostels(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Rooms
create table rooms (
  id          uuid primary key default uuid_generate_v4(),
  floor_id    uuid not null references floors(id) on delete cascade,
  hostel_id   uuid not null references hostels(id) on delete cascade,
  room_number text not null,
  capacity    int not null default 1,
  rent_amount numeric(10,2) not null default 0,
  status      text not null default 'vacant' check (status in ('vacant','occupied','maintenance')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Tenants (PII separated from operational data)
create table tenants (
  id              uuid primary key default uuid_generate_v4(),
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  owner_id        uuid not null references owners(id),
  hostel_id       uuid not null references hostels(id),
  room_id         uuid references rooms(id) on delete set null,
  full_name       text not null,
  email           text,
  phone           text,
  aadhar_last4    text,             -- only last 4 digits stored in plain text
  aadhar_doc_path text,             -- encrypted Supabase Storage path
  join_date       date,
  move_out_date   date,
  status          text not null default 'pending' check (status in ('pending','active','moved_out','rejected')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Payments
create table payments (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id),
  hostel_id       uuid not null references hostels(id),
  amount          numeric(10,2) not null,
  month           date not null,             -- first day of billing month
  status          text not null default 'pending' check (status in ('pending','paid','overdue','disputed')),
  method          text check (method in ('cash','upi','bank_transfer','razorpay','other')),
  razorpay_id     text,
  receipt_number  text unique,
  notes           text,
  paid_at         timestamptz,
  ip_address      inet,
  recorded_by     uuid references owners(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Notices
create table notices (
  id          uuid primary key default uuid_generate_v4(),
  hostel_id   uuid not null references hostels(id) on delete cascade,
  owner_id    uuid not null references owners(id),
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Maintenance requests
create table maintenance_requests (
  id          uuid primary key default uuid_generate_v4(),
  hostel_id   uuid not null references hostels(id),
  room_id     uuid references rooms(id),
  tenant_id   uuid references tenants(id),
  title       text not null,
  description text,
  status      text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Subscriptions
create table subscriptions (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references owners(id),
  plan            text not null,
  status          text not null default 'active' check (status in ('active','cancelled','expired','grace_period')),
  razorpay_sub_id text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Invite codes for tenant registration
create table invite_codes (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references owners(id),
  hostel_id   uuid not null references hostels(id),
  code        text unique not null,
  used_by     uuid references tenants(id),
  used_at     timestamptz,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- Audit logs (append-only — never delete rows)
create table audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid references owners(id),
  user_id     uuid references auth.users(id),
  action      text not null,
  table_name  text not null,
  record_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Consent records (DPDP Act 2023)
create table consent_records (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id),
  consent_type    text not null check (consent_type in ('data_collection','marketing_email','whatsapp','third_party')),
  consent_given   boolean not null,
  ip_address      inet,
  form_version    text,
  created_at      timestamptz not null default now()
);

-- Data deletion requests (DPDP Act 2023)
create table data_deletion_requests (
  id              uuid primary key default uuid_generate_v4(),
  requested_by    uuid not null references auth.users(id),
  tenant_id       uuid references tenants(id),
  status          text not null default 'pending' check (status in ('pending','processing','completed','rejected')),
  reason          text,
  processed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### Step 2 — Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
alter table owners                  enable row level security;
alter table hostels                 enable row level security;
alter table floors                  enable row level security;
alter table rooms                   enable row level security;
alter table tenants                 enable row level security;
alter table payments                enable row level security;
alter table notices                 enable row level security;
alter table maintenance_requests    enable row level security;
alter table subscriptions           enable row level security;
alter table invite_codes            enable row level security;
alter table audit_logs              enable row level security;
alter table consent_records         enable row level security;
alter table data_deletion_requests  enable row level security;

-- Helper function: get owner id for the current user
create or replace function current_owner_id()
returns uuid language sql security definer stable as $$
  select id from owners where auth_user_id = auth.uid() limit 1;
$$;

-- Owners: only see own row
create policy "owner_select_own" on owners for select using (auth_user_id = auth.uid());
create policy "owner_update_own" on owners for update using (auth_user_id = auth.uid());

-- Hostels: owner CRUD on own hostels
create policy "hostel_select" on hostels for select using (owner_id = current_owner_id());
create policy "hostel_insert" on hostels for insert with check (owner_id = current_owner_id());
create policy "hostel_update" on hostels for update using (owner_id = current_owner_id());
create policy "hostel_delete" on hostels for delete using (owner_id = current_owner_id());

-- Floors
create policy "floor_select" on floors for select using (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
);
create policy "floor_insert" on floors for insert with check (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
);
create policy "floor_update" on floors for update using (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
);

-- Rooms
create policy "room_select" on rooms for select using (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
);
create policy "room_insert" on rooms for insert with check (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
);
create policy "room_update" on rooms for update using (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
);

-- Tenants: owner sees own, tenant sees self
create policy "tenant_select_owner" on tenants for select using (
  owner_id = current_owner_id()
  or auth_user_id = auth.uid()
);
create policy "tenant_insert_owner" on tenants for insert with check (owner_id = current_owner_id());
create policy "tenant_update_owner" on tenants for update using (owner_id = current_owner_id());

-- Payments
create policy "payment_select" on payments for select using (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
  or tenant_id in (select id from tenants where auth_user_id = auth.uid())
);
create policy "payment_insert" on payments for insert with check (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
);
create policy "payment_update" on payments for update using (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
);

-- Notices
create policy "notice_select" on notices for select using (
  owner_id = current_owner_id()
  or hostel_id in (select hostel_id from tenants where auth_user_id = auth.uid() and status = 'active')
);
create policy "notice_insert" on notices for insert with check (owner_id = current_owner_id());
create policy "notice_update" on notices for update using (owner_id = current_owner_id());

-- Maintenance requests
create policy "maint_select" on maintenance_requests for select using (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
  or tenant_id in (select id from tenants where auth_user_id = auth.uid())
);
create policy "maint_insert" on maintenance_requests for insert with check (
  hostel_id in (select id from hostels where owner_id = current_owner_id())
  or tenant_id in (select id from tenants where auth_user_id = auth.uid())
);

-- Subscriptions
create policy "sub_select" on subscriptions for select using (owner_id = current_owner_id());
create policy "sub_insert" on subscriptions for insert with check (owner_id = current_owner_id());

-- Invite codes
create policy "invite_select" on invite_codes for select using (owner_id = current_owner_id());
create policy "invite_insert" on invite_codes for insert with check (owner_id = current_owner_id());

-- Audit logs: owners see own logs only (append-only — no update/delete policies)
create policy "audit_select" on audit_logs for select using (owner_id = current_owner_id());

-- Consent records: user sees own
create policy "consent_select" on consent_records for select using (user_id = auth.uid());
create policy "consent_insert" on consent_records for insert with check (user_id = auth.uid());

-- Data deletion requests
create policy "deletion_req_select" on data_deletion_requests for select using (requested_by = auth.uid());
create policy "deletion_req_insert" on data_deletion_requests for insert with check (requested_by = auth.uid());
```

### Step 3 — Triggers, Indexes & Storage

```sql
-- Auto-update updated_at on every table that has it
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger owners_updated_at              before update on owners              for each row execute function set_updated_at();
create trigger hostels_updated_at             before update on hostels             for each row execute function set_updated_at();
create trigger rooms_updated_at               before update on rooms               for each row execute function set_updated_at();
create trigger tenants_updated_at             before update on tenants             for each row execute function set_updated_at();
create trigger payments_updated_at            before update on payments            for each row execute function set_updated_at();
create trigger maintenance_requests_updated_at before update on maintenance_requests for each row execute function set_updated_at();
create trigger subscriptions_updated_at       before update on subscriptions       for each row execute function set_updated_at();
create trigger data_deletion_requests_updated_at before update on data_deletion_requests for each row execute function set_updated_at();

-- Useful indexes
create index idx_hostels_owner         on hostels(owner_id)   where deleted_at is null;
create index idx_rooms_hostel          on rooms(hostel_id)    where deleted_at is null;
create index idx_tenants_owner         on tenants(owner_id)   where deleted_at is null;
create index idx_tenants_hostel        on tenants(hostel_id)  where deleted_at is null;
create index idx_payments_tenant       on payments(tenant_id);
create index idx_payments_hostel_month on payments(hostel_id, month);
create index idx_audit_logs_owner      on audit_logs(owner_id, created_at desc);
create index idx_consent_user          on consent_records(user_id, consent_type);

-- Storage bucket for tenant documents (private — signed URLs only)
-- Run in Supabase Storage SQL or create manually in the dashboard:
insert into storage.buckets (id, name, public)
values ('tenant-documents', 'tenant-documents', false);

-- Only owners can upload to their own path, tenants can upload to their own
create policy "tenant_docs_insert" on storage.objects for insert
  with check (bucket_id = 'tenant-documents' and auth.role() = 'authenticated');

create policy "tenant_docs_select" on storage.objects for select
  using (bucket_id = 'tenant-documents' and auth.role() = 'authenticated');
```

---

## 🔧 Updated Supabase File Structure

Three files now exist instead of the original two:

```
src/lib/supabase/
├── client.ts      # Browser client — uses validateSupabaseEnv()
├── server.ts      # Server client — uses cookies() for SSR
├── admin.ts       # Server-only admin client — bypasses RLS (service_role key)
└── env-check.ts   # Shared env validator — descriptive startup errors
```

### `src/lib/supabase/admin.ts` (new)

```ts
import { createClient } from "@supabase/supabase-js";
import { validateSupabaseEnv, validateServiceRoleKey } from "./env-check";

export function createAdminClient() {
  const { url } = validateSupabaseEnv();
  const serviceRoleKey = validateServiceRoleKey();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

### `src/lib/supabase/env-check.ts` (new)

```ts
export function validateSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || url === "https://YOUR_PROJECT_ID.supabase.co")
    throw new Error("[NestDesk] NEXT_PUBLIC_SUPABASE_URL is missing");

  if (!anonKey || anonKey === "YOUR_ANON_KEY")
    throw new Error("[NestDesk] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");

  return { url, anonKey };
}

export function validateServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey === "YOUR_SERVICE_ROLE_KEY")
    throw new Error(
      "[NestDesk] SUPABASE_SERVICE_ROLE_KEY is missing — server side only",
    );
  return serviceRoleKey;
}
```

---

## 💰 Pricing Plans (Updated)

`src/app/page.tsx` now renders a full landing page with 5 pricing tiers:

| Plan       | Price/month | Properties | Tenants per property | Status        |
| ---------- | ----------- | ---------- | -------------------- | ------------- |
| Free       | ₹0          | 1          | Up to 30             | —             |
| Starter    | ₹599        | 1          | Up to 75             | —             |
| Pro        | ₹1,199      | 2          | Up to 100            | Most Popular  |
| Business   | ₹2,499      | 5          | Up to 100 each       | —             |
| Enterprise | Custom      | Unlimited  | Unlimited            | Contact sales |

Enterprise CTA → `mailto:sales@nestdesk.in`

---

## 📁 Updated `.env.local` Structure

```env
# ── DEV environment (nestdesk-dev Supabase project) ──────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://qviwaspbhijvchmmbub.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev anon key>
SUPABASE_SERVICE_ROLE_KEY=<dev service role key>
```

`.env.example` (committed, no real values):

```env
# ── DEV environment (nestdesk-dev Supabase project) ──────────────────────────
# Copy this file to .env.local and fill in real values. NEVER commit .env.local.

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_DEV_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_DEV_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_DEV_SERVICE_ROLE_KEY

# ── PROD environment — set these in Vercel dashboard ONLY ────────────────────
# NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROD_PROJECT_ID.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PROD_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY=YOUR_PROD_SERVICE_ROLE_KEY
```

---

## ⏳ Pending Tasks (Next Up)

### Supabase DEV (do now)

- [ ] Run SQL Steps 1 → 2 → 3 in **nestdesk-dev** Supabase SQL Editor
- [ ] Create storage bucket `tenant-documents` (private) in nestdesk-dev Storage dashboard
- [ ] Enable email verification in nestdesk-dev Auth → Settings
- [ ] Set minimum password length to 8 in nestdesk-dev Auth settings

### Supabase PROD (do now)

- [ ] Create `nestdesk-prod` Supabase project (Mumbai region)
- [ ] Run SQL Steps 1 → 2 → 3 in **nestdesk-prod** Supabase SQL Editor
- [ ] Create storage bucket `tenant-documents` (private) in nestdesk-prod Storage dashboard
- [ ] Enable email verification in nestdesk-prod Auth → Settings
- [ ] Set minimum password length to 8 in nestdesk-prod Auth settings
- [ ] Copy prod URL + anon key + service role key from nestdesk-prod → Settings → API

### Vercel Dev Setup (do now)

- [ ] Import GitHub repo to Vercel (if not already done)
- [ ] Add env vars — check **Preview** environment only:
  - `NEXT_PUBLIC_SUPABASE_URL` → `https://qviwaspbhijvchmmbub.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → nestdesk-dev anon key
  - `SUPABASE_SERVICE_ROLE_KEY` → nestdesk-dev service role key
- [ ] Verify `nestdesk-git-initial-xxxx.vercel.app` preview URL loads correctly

### Vercel Production Setup (do now)

- [ ] Add env vars — check **Production** environment only:
  - `NEXT_PUBLIC_SUPABASE_URL` → nestdesk-prod project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → nestdesk-prod anon key
  - `SUPABASE_SERVICE_ROLE_KEY` → nestdesk-prod service role key
- [ ] Vercel → Settings → Domains → Add `nestdesk.in` → assign to Production (main)
- [ ] Vercel → Settings → Domains → Add `www.nestdesk.in` → assign to Production (main)
- [ ] Confirm production branch is `main` in Vercel → Settings → Git

### DNS (Hostinger) — do now

- [ ] Log in to hpanel.hostinger.com → Domains → `nestdesk.in` → DNS Records
- [ ] Add `A` record: Name `@` → Value `76.76.21.21` → TTL `3600`
- [ ] Add `CNAME` record: Name `www` → Value from Vercel's domain config for `www.nestdesk.in` → TTL `3600`
- [ ] Wait 5–30 min for DNS propagation
- [ ] Click **Refresh** in Vercel → both domains should turn green
- [ ] Verify SSL certificate active

### Day 3 (Next)

- [ ] Authentication UI — real Supabase login (email + password)
- [ ] Email verification flow
- [ ] Rate limiting on `/api/auth/*` routes (5 attempts → 15 min lockout)
- [ ] Session timeout (30 min idle)
- [ ] Secure httpOnly cookies
