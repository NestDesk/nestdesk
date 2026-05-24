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
import {
  Building2,
  Zap,
  Users,
  CreditCard,
  Bell,
  FileText,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Star,
  Globe,
  TrendingUp,
  ClipboardList,
  MessageSquare,
  BadgeCheck,
} from "lucide-react";

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

const features = [
  {
    icon: Users,
    title: "Tenant Management",
    description:
      "Onboard tenants digitally with complete profiles, contact details, and stay history in one place.",
  },
  {
    icon: Building2,
    title: "Room & Floor Control",
    description:
      "Visual occupancy grid across all floors. Track vacancies, assign rooms, and manage capacity in real time.",
  },
  {
    icon: CreditCard,
    title: "Payments & Receipts",
    description:
      "Accept UPI, cards, and net banking. Send payment confirmations and receipts automatically.",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description:
      "Automated rent reminders via WhatsApp and email so you spend less time chasing payments.",
  },
  {
    icon: ClipboardList,
    title: "Activity Timeline",
    description:
      "Track key actions like bookings, room changes, and payments with a clear activity history.",
  },
  {
    icon: BarChart3,
    title: "Financial Dashboard",
    description:
      "Monthly P&L, collection efficiency, and exportable reports. Your CA will love the clean CSV export.",
  },
  {
    icon: FileText,
    title: "Document Storage",
    description:
      "Store tenant documents securely and find them quickly whenever you need them.",
  },
  {
    icon: MessageSquare,
    title: "Maintenance Requests",
    description:
      "Tenants raise issues from their portal. You track, assign, and resolve — all with full timestamp history.",
  },
  {
    icon: TrendingUp,
    title: "Subscription Tiers",
    description:
      "Start free, scale as you grow. Upgrade or downgrade any time. Data always retained, never lost on plan change.",
  },
];

const steps = [
  {
    step: "01",
    title: "Set up your property",
    description:
      "Add your property, configure floors and rooms, and invite your first tenant in under 10 minutes.",
  },
  {
    step: "02",
    title: "Tenants onboard themselves",
    description:
      "Share a unique invite link. Tenants fill their profile, upload documents, and give consent — digitally.",
  },
  {
    step: "03",
    title: "Manage everything from one dashboard",
    description:
      "Collect rent, send reminders, track maintenance, and generate receipts from one simple dashboard.",
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
      "My CA asked for 6 months of payment records. I exported a CSV in 30 seconds. That never happened with my old system.",
  },
];

const pricing = [
  {
    name: "Free",
    price: "0",
    period: "forever",
    description: "For owners just getting started",
    features: ["Up to 10 tenants", "1 property", "Basic payments", "Email support"],
    cta: "Start Free",
    ctaHref: "/register",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "599",
    period: "month",
    description: "For growing PGs and properties",
    features: [
      "Up to 75 tenants",
      "1 property",
      "Razorpay payments",
      "WhatsApp reminders",
      "Document storage",
      "Activity timeline",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "1,199",
    period: "month",
    description: "Most popular for established operators",
    features: [
      "Up to 100 tenants each",
      "2 properties",
      "Everything in Starter",
      "Professional receipts",
      "Financial reports",
      "Priority support",
      "Data export (CSV/PDF)",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register",
    highlighted: true,
  },
  {
    name: "Business",
    price: "2,499",
    period: "month",
    description: "For chains and large operators",
    features: [
      "100 tenants in each",
      "5 properties",
      "Everything in Pro",
      "Custom branding",
      "Dedicated onboarding",
      "Phone support",
      "SLA guarantee",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register",
    highlighted: false,
  },
  {
    name: "Enterprise",
    price: null,
    period: null,
    description: "For very large chains and custom operations",
    features: [
      "Unlimited properties",
      "Multi-location setup",
      "Custom integrations",
      "Dedicated account manager",
      "Priority onboarding and migration",
      "Custom SLA",
    ],
    cta: "Connect to Sales Office",
    ctaHref: "mailto:sales@nestdesk.in",
    highlighted: false,
  },
];

const trustBadges = [
  { icon: BadgeCheck, label: "Setup in under 10 minutes" },
  { icon: Zap, label: "Fast rent tracking" },
  { icon: MessageSquare, label: "WhatsApp reminders" },
  { icon: ClipboardList, label: "Clear tenant records" },
  { icon: TrendingUp, label: "Useful reports" },
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
                    Start Free
                    <ArrowRight className="ml-2 h-4 w-4" />
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
          <Badge
            variant="secondary"
            className="mb-4 rounded-full px-4 py-1.5 text-sm"
          >
            Everything you need
          </Badge>
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
            <Badge
              variant="secondary"
              className="mb-4 rounded-full px-4 py-1.5 text-sm"
            >
              Simple setup
            </Badge>
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Up and running in minutes
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
      <section id="pricing" className="bg-muted/30 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex flex-col items-center text-center">
            <Badge
              variant="secondary"
              className="mb-4 rounded-full px-4 py-1.5 text-sm"
            >
              Simple pricing
            </Badge>
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Plans that grow with you
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Start free. Upgrade when you need more. Your data is always yours — we
              never delete it on plan changes.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {pricing.map(
              ({
                name,
                price,
                period,
                description,
                features: planFeatures,
                cta,
                ctaHref,
                highlighted,
              }) => (
                <div
                  key={name}
                  className={`relative flex flex-col rounded-2xl border p-6 ${
                    highlighted
                      ? "border-primary/0 bg-gradient-to-br from-primary via-blue-600 to-blue-700 shadow-xl shadow-primary/30"
                      : "card-hover border-border/60 bg-card/80 backdrop-blur-sm"
                  }`}
                >
                  {highlighted && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-1 text-xs font-semibold text-white ring-2 ring-background">
                      Most Popular
                    </span>
                  )}

                  <div className="mb-4">
                    <h3
                      className={`text-lg font-bold ${highlighted ? "text-white" : "text-foreground"}`}
                    >
                      {name}
                    </h3>
                    <p
                      className={`mt-1 h-8 text-xs leading-4 ${highlighted ? "text-white/70" : "text-muted-foreground"}`}
                    >
                      {description}
                    </p>
                  </div>

                  <div className="mb-6">
                    <span
                      className={`text-3xl font-bold leading-none tracking-tight ${highlighted ? "text-white" : "text-foreground"}`}
                    >
                      {price === "0" ? "Free" : price ? `Rs.${price}` : "Custom"}
                    </span>
                    {price && price !== "0" && period && (
                      <span
                        className={`ml-1 text-sm ${highlighted ? "text-white/70" : "text-muted-foreground"}`}
                      >
                        /{period}
                      </span>
                    )}
                  </div>

                  <ul className="mb-8 flex-1 space-y-2.5">
                    {planFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2
                          className={`mt-0.5 h-4 w-4 shrink-0 ${highlighted ? "text-white/80" : "text-primary"}`}
                        />
                        <span
                          className={
                            highlighted ? "text-white/90" : "text-muted-foreground"
                          }
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link href={ctaHref}>
                    <Button
                      className={`w-full rounded-xl ${
                        highlighted ? "bg-white text-primary hover:bg-white/90" : ""
                      }`}
                      variant={highlighted ? "secondary" : "default"}
                    >
                      {cta}
                    </Button>
                  </Link>
                </div>
              ),
            )}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Paid plans include a 14-day free trial &bull; No credit card required
            &bull; Cancel any time
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {/* Brand */}
            <div className="lg:col-span-2">
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

            {/* Product */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["Features", "Pricing", "Demo", "Changelog"].map((item) => (
                  <li key={item}>
                    <Link
                      href="#"
                      className="transition-colors hover:text-foreground"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["About", "Blog", "Contact", "Careers"].map((item) => (
                  <li key={item}>
                    <Link
                      href="#"
                      className="transition-colors hover:text-foreground"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  "Privacy Policy",
                  "Terms of Service",
                  "Cookie Policy",
                  "Refund Policy",
                ].map((item) => (
                  <li key={item}>
                    <Link
                      href="#"
                      className="transition-colors hover:text-foreground"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
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
