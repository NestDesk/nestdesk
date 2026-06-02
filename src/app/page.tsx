import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import HeroSvg from "@/components/layout/HeroSvg";
import { LandingMobileNav } from "@/components/layout/LandingMobileNav";
import {
  LandingAccountMenu,
  type LandingAccountUser,
} from "@/components/layout/LandingAccountMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { LegalPolicyLauncher } from "@/components/legal/LegalPolicyLauncher";
import { PricingSection } from "@/components/layout/PricingSection";
import {
  Building2,
  Zap,
  Users,
  CreditCard,
  Bell,
  FileText,
  BarChart3,
  Star,
  Globe,
  ClipboardList,
  MessageSquare,
  BadgeCheck,
  User,
  MessageCircle,
  Megaphone,
} from "lucide-react";

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

const features = [
  {
    icon: Users,
    title: "Tenant Lifecycle Management",
    description:
      "Manage onboarding, profile completion, approvals, move-outs, and room assignment from one owner workspace.",
  },
  {
    icon: Building2,
    title: "Property Setup & Occupancy",
    description:
      "Create floors and rooms, set capacity, and monitor live occupancy with property and floor-level visibility.",
  },
  {
    icon: CreditCard,
    title: "Rent Payments & Billing Periods",
    description:
      "Record and update rent payments, track billing periods, set statuses, and manage receipt records in one flow.",
  },
  {
    icon: Bell,
    title: "Notices for Tenants",
    description:
      "Create, publish, unpublish, and manage property notices with separate owner and tenant views.",
  },
  {
    icon: ClipboardList,
    title: "Owner Operations Console",
    description:
      "Run daily operations across tenants, rooms, payments, maintenance, notices, and owner profile from a single dashboard.",
  },
  {
    icon: BarChart3,
    title: "Expense Tracking",
    description:
      "Track property expenses with category and status controls, then monitor spend using built-in owner analytics cards.",
  },
  {
    icon: FileText,
    title: "Tenant KYC Documents",
    description:
      "Review tenant-uploaded profile photos and ID proofs with secure signed URLs in the owner review flow.",
  },
  {
    icon: MessageSquare,
    title: "Maintenance Requests",
    description:
      "Tenants raise issues from their portal while owners update status and add comments with full request history.",
  },
  {
    icon: User,
    title: "Owner Profile & Account",
    description:
      "Keep owner contact details updated from the profile page with inline editing and validated save flows.",
  },
];

const steps = [
  {
    step: "01",
    title: "Create your owner workspace",
    description:
      "Register, complete onboarding, and set up your owner profile to unlock the full dashboard.",
  },
  {
    step: "02",
    title: "Set up properties, floors, and rooms",
    description:
      "Add your hostels, configure room capacity, and prepare occupancy before moving tenants in.",
  },
  {
    step: "03",
    title: "Run daily operations from one place",
    description:
      "Manage tenants, payments, notices, maintenance, and expenses from a single operational command center.",
  },
];

const testimonials = [
  {
    name: "Ravi Shankar",
    role: "Owner, Shankar Boys Hostel, Pune",
    initials: "RS",
    quote:
      "I used to manage 40 tenants in WhatsApp groups and Excel. NestDesk replaced all of that in one weekend. Rent collection alone saves me 3 hours a month.",
  },
  {
    name: "Divya Menon",
    role: "Owner, GreenLeaf PG, Bangalore",
    initials: "DM",
    quote:
      "The dashboard is simple to use and my team learned it quickly. We now track payments and maintenance without messy spreadsheets.",
  },
  {
    name: "Arjun Patel",
    role: "Owner, City Stay PG, Ahmedabad",
    initials: "AP",
    quote:
      "The tenant review flow and payment tracking are much clearer now. I can check room occupancy and tenant status in minutes.",
  },
];

const trustBadges = [
  { icon: BadgeCheck, label: "Property setup in 10 minutes" },
  { icon: Zap, label: "Fast rent tracking" },
  { icon: Users, label: "Owner + tenant portals" },
  { icon: Building2, label: "Live occupancy visibility" },
  { icon: MessageSquare, label: "Maintenance requests" },
  { icon: MessageCircle, label: "WhatsApp rent reminders" },
  { icon: Megaphone, label: "Broadcast tenant notices" },
];

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const landingUser: LandingAccountUser | null = user
    ? {
        fullName:
          (user.user_metadata?.full_name as string | undefined)?.trim() ||
          user.email?.split("@")[0] ||
          "Owner",
        email: user.email ?? "",
        avatarUrl:
          (user.user_metadata?.avatar_url as string | undefined)?.trim() || null,
      }
    : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background bg-mesh-light dark:bg-mesh-dark">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.04] via-background to-background dark:from-primary/[0.1] dark:via-background dark:to-background" />
      <div className="pointer-events-none absolute -left-32 top-28 -z-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />
      <div className="pointer-events-none absolute -right-28 top-44 -z-10 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-400/15" />
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 1200"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-50 dark:opacity-35"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="nestdesk-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M48 0H0V48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-primary/10 dark:text-primary/15"
            />
          </pattern>
          <radialGradient id="nestdesk-radial" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              className="text-cyan-400/20 dark:text-cyan-300/25"
              stopColor="currentColor"
            />
            <stop
              offset="100%"
              className="text-transparent"
              stopColor="currentColor"
            />
          </radialGradient>
        </defs>

        <rect width="1440" height="1200" fill="url(#nestdesk-grid)" />
        <circle cx="1120" cy="220" r="240" fill="url(#nestdesk-radial)" />
        <circle cx="280" cy="980" r="280" fill="url(#nestdesk-radial)" />

        <path
          d="M-40 220C180 80 380 80 620 220C860 360 1080 360 1480 180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary/20 dark:text-primary/25"
        />
        <path
          d="M-20 760C230 620 440 610 690 760C940 910 1160 920 1480 760"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-cyan-500/20 dark:text-cyan-300/25"
        />
      </svg>

      {/* ── Navbar ─────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <LandingMobileNav user={landingUser} />
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-400 shadow shadow-primary/30">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-foreground">NestDesk</span>
            </Link>
          </div>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <Link
              href="#features"
              className="transition-colors hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="transition-colors hover:text-foreground"
            >
              How it works
            </Link>
            <Link
              href="#pricing"
              className="transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {landingUser ? (
              <div className="hidden sm:block">
                <LandingAccountMenu user={landingUser} />
              </div>
            ) : (
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="rounded-xl">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background gradient blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/6 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14 lg:pt-16">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
            {/* Left: Text content */}
            <div className="flex flex-1 flex-col items-start text-left">
              <Badge
                variant="secondary"
                className="mb-4 gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium"
              >
                <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                Built for Hostels, PGs, Colives &amp; Rentals in India
              </Badge>

              <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                The modern way to{" "}
                <span className="relative inline-block">
                  <span className="text-gradient relative z-10">
                    manage your property
                  </span>
                  <span className="absolute -bottom-1 left-0 right-0 z-0 h-3 rounded-full bg-gradient-to-r from-primary/20 via-blue-500/15 to-blue-400/10 blur-sm" />
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:text-xl">
                Tenants, rooms, payments, notices, and maintenance for PGs, colives,
                hostels, and rental properties in one simple dashboard.
              </p>

              <div className="mt-8 flex flex-row flex-wrap gap-4">
                <Link href="/register">
                  <Button
                    size="default"
                    className="h-10 rounded-xl bg-gradient-to-r from-primary to-blue-500 px-6 text-sm font-semibold shadow-lg shadow-primary/30 hover:brightness-110 hover:shadow-primary/50"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Join as Owner
                  </Button>
                </Link>
                <Link href="/join">
                  <Button
                    size="default"
                    variant="outline"
                    className="h-10 rounded-xl px-6 text-sm hover:border-primary/40 hover:bg-primary/5"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Join as Tenant
                  </Button>
                </Link>
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                Free plan available &bull; Setup in under 10 minutes &bull; No
                contracts
              </p>

              {/* Trust bar */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                {trustBadges.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Illustration */}
            <div className="hidden flex-1 items-center justify-center sm:flex lg:justify-end">
              <HeroSvg className="animate-float w-full max-w-xs text-primary drop-shadow-xl sm:max-w-sm lg:max-w-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────── */}
      {/* <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map(({ value, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 text-center"
              >
                <span className="text-3xl font-bold text-foreground sm:text-4xl">
                  {value}
                </span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* ── Divider ────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Separator />
      </div>

      {/* ── Features ───────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-10 flex flex-col items-center text-center">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for how managed properties actually work
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Every feature is designed around real workflows of PGs, colives, hostels,
            and rental properties, not generic software.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="card-hover group rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-blue-400/10 transition-all group-hover:from-primary/25 group-hover:to-blue-400/20">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────── */}
      <section id="how-it-works" className="bg-muted/30 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex flex-col items-center text-center">
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Up and running in minutes - simple!
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map(({ step, title, description }) => (
              <div key={step} className="relative flex flex-col items-start">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                  <span className="text-2xl font-bold text-primary">{step}</span>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="mb-10 flex flex-col items-center text-center">
          <Badge
            variant="secondary"
            className="mb-4 rounded-full px-4 py-1.5 text-sm"
          >
            Trusted by owners
          </Badge>
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Owners love NestDesk
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {testimonials.map(({ name, role, initials, quote }) => (
            <Card
              key={name}
              className="card-hover rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-400 text-sm font-bold text-white shadow shadow-primary/30">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────── */}
      <PricingSection />

      {/* ── Footer ─────────────────────────────── */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
            {/* Brand */}
            <div className="max-w-md">
              <Link href="/" className="mb-4 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-400 shadow shadow-primary/30">
                  <Building2 className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-foreground">NestDesk</span>
              </Link>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Modern management software for PGs, colives, hostels, and rental
                properties. Simple, practical, and easy to use.
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                Data stored in India &bull; Supabase (Mumbai region)
              </p>
            </div>

            {/* Footer nav */}
            <div className="grid gap-10 sm:grid-cols-2 sm:items-start">
              <div className="space-y-3">
                {/* <h4 className="text-sm font-semibold text-foreground">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {["About", "Contact Us", "Careers"].map((item) => (
                    <li key={item}>
                      <Link
                        href="#"
                        className="transition-colors hover:text-foreground"
                      >
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul> */}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Legal</h4>
                <LegalPolicyLauncher />
              </div>
            </div>
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
            <span>
              &copy; {new Date().getFullYear()} NestDesk. All rights reserved.
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3 w-3" /> Made in India
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
