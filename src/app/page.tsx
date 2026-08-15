import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { Navbar, NavbarLogo } from "../components/layout/Navbar";
import { Badge } from "../components/ui/badge";
import { ThemeToggle } from "../components/layout/ThemeToggle";
import HeroSvg from "../components/layout/HeroSvg";
import { LandingMobileNav } from "../components/layout/LandingMobileNav";
import {
  LandingAccountMenu,
  type LandingAccountUser,
} from "../components/layout/LandingAccountMenu";
import { Card, CardContent } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { createClient } from "../lib/supabase/server";
import { LegalPolicyLauncher } from "../components/legal/LegalPolicyLauncher";
import { PricingSection } from "../components/layout/PricingSection";
import { ScreenshotCarousel } from "../components/layout/ScreenshotCarousel";
import { PromoVideoSection } from "../components/layout/PromoVideoSection";
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
  MapPin,
  Phone,
  ArrowRight,
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
    name: "Sagnik Banerjee",
    role: "Owner, KOLKATA PG & FLAT RENTALS, Kolkata",
    initials: "SB",
    quote:
      "I used to manage 40 tenants in WhatsApp groups and Excel. NestDesk replaced all of that, Rent collection alone saves me many hours a month.",
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
  { icon: BadgeCheck, label: "Property setup in 2 minutes" },
  { icon: Zap, label: "Fast rent tracking" },
  { icon: Building2, label: "Live occupancy visibility" },
  { icon: MessageSquare, label: "Maintenance requests" },
  { icon: MessageCircle, label: "WhatsApp rent reminders" },
  { icon: Megaphone, label: "Broadcast tenant notices" },
  { icon: Users, label: "Owner + tenant Dashboards" },
];

const PROMO_VIDEO_URL = process.env.PROMO_VIDEO_URL;

export const metadata: Metadata = {
  title: "PG & Hostel Management Software | NestDesk",
  description:
    "NestDesk helps PG owners, hostel managers, and co-living operators manage tenants, collect rent, send notices, and track maintenance from one dashboard.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "PG & Hostel Management Software | NestDesk",
    description:
      "Manage tenants, rent, notices, and maintenance for your PG, hostel, or co-living space with NestDesk.",
    url: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "NestDesk",
      url: "https://nestdesk.in",
      logo: "https://nestdesk.in/favicon.ico",
      contactPoint: {
        "@type": "ContactPoint",
        email: "support@nestdesk.in",
        contactType: "customer support",
      },
    },
    {
      "@type": "WebSite",
      url: "https://nestdesk.in",
      name: "NestDesk",
      description:
        "Modern property management platform for PGs, co-living spaces, hostels, and rentals.",
    },
    {
      "@type": "SoftwareApplication",
      name: "NestDesk",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
        description: "Free plan available",
      },
    },
  ],
};

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
          (user.user_metadata?.avatar_url as string | undefined)?.trim() ||
          null,
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="relative min-h-screen overflow-x-clip bg-background">
        {/* ── Navbar ─────────────────────────────── */}
        <Navbar
          left={
            <>
              <LandingMobileNav user={landingUser} />
              <NavbarLogo />
            </>
          }
          center={
            <>
              <a
                href="#video"
                className="transition-colors hover:text-foreground"
              >
                Video
              </a>
              <a
                href="#features"
                className="transition-colors hover:text-foreground"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="transition-colors hover:text-foreground"
              >
                How it works
              </a>
              <a
                href="#demo"
                className="transition-colors hover:text-foreground"
              >
                Demo
              </a>
              <a
                href="#pricing"
                className="transition-colors hover:text-foreground"
              >
                Pricing
              </a>
              <Link
                href="/help"
                className="transition-colors hover:text-foreground"
              >
                Help
              </Link>
            </>
          }
          right={
            <>
              <ThemeToggle />
              {landingUser ? (
                <div className="hidden sm:block">
                  <LandingAccountMenu user={landingUser} />
                </div>
              ) : (
                <Link href="/login" className="hidden sm:block">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-4 text-sm font-medium hover:bg-muted"
                  >
                    Sign in
                  </Button>
                </Link>
              )}
            </>
          }
        />

        {/* ── Hero ───────────────────────────────── */}
        <section className="relative pt-2 pb-2 sm:pt-2 sm:pb-2 lg:pt-2 lg:pb-2">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
              <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                <Badge
                  variant="secondary"
                  className="mb-6 gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                >
                  <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                  Built for Hostels, PGs, Colives &amp; Rentals in India
                </Badge>

                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  The modern way to{" "}<br/>
                  <span className="text-primary">manage your property</span>
                </h1>

                <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                  Tenants, rooms, payments, notices, and maintenance for PGs,
                  colives, hostels, and rental properties in one simple
                  dashboard.
                </p>

                <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
                  <Link href="/register">
                    <Button
                      size="lg"
                      className="h-12 rounded-full px-8 text-base font-medium shadow-none transition-all hover:shadow-md"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Join as Owner
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/join">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-full px-8 text-base font-medium hover:bg-muted"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Join as Tenant
                    </Button>
                  </Link>
                </div>

                <p className="mt-6 text-sm text-muted-foreground">
                  Already using NestDesk?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Log in
                  </Link>
                </p>

                <p className="mt-4 text-sm text-muted-foreground">
                  Free plan available &middot; No contracts &middot; No setup
                  fees
                </p>

                {/* Trust bar */}
                <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:justify-start">
                  {trustBadges.map(({ icon: Icon, label }) => (
                    <span
                      key={label}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative hidden items-center justify-center lg:flex">
                <div className="relative flex aspect-square w-full max-w-lg items-center justify-center rounded-3xl  p-10">
                  <HeroSvg className="w-full max-w-sm text-primary/80" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Video walkthrough ─────────────────── */}
        <PromoVideoSection videoUrl={PROMO_VIDEO_URL} />

        {/* ── Features ───────────────────────────── */}
        <section id="features" className="py-4 sm:py-4">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-16 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Built for how managed properties actually work
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Every feature is designed around real workflows of PGs, colives,
                hostels, and rental properties, not generic software.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <Card
                  key={title}
                  className="card-hover group rounded-2xl border-border/60 bg-card shadow-none"
                >
                  <CardContent className="p-8">
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-2 text-lg font-medium text-foreground">
                      {title}
                    </h3>
                    <p className="leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ───────────────────────── */}
        <section
          id="how-it-works"
          className="border-y border-border bg-muted/20 py-8 sm:py-8"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-16 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Up and running in minutes
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A simple setup process that gets you operational today.
              </p>
            </div>

            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map(({ step, title, description }) => (
                <div key={step} className="relative flex flex-col">
                  <span className="mb-6 text-5xl font-semibold text-muted-foreground/40">
                    {step}
                  </span>
                  <h3 className="mb-2 text-xl font-medium text-foreground">
                    {title}
                  </h3>
                  <p className="leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ───────────────────────── */}
        <section className="py-8 sm:py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-16 max-w-2xl">
              <Badge
                variant="secondary"
                className="mb-4 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
              >
                Trusted by owners
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Owners love NestDesk
              </h2>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {testimonials.map(({ name, role, initials, quote }) => (
                <Card
                  key={name}
                  className="rounded-2xl border-border/60 bg-card shadow-none"
                >
                  <CardContent className="flex h-full flex-col p-8">
                    <div className="mb-6 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-primary text-primary"
                        />
                      ))}
                    </div>
                    <p className="mb-8 flex-1 text-lg leading-relaxed text-foreground">
                      &ldquo;{quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {name}
                        </p>
                        <p className="text-xs text-muted-foreground">{role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Demo at a glance ──────────────────── */}
        <ScreenshotCarousel />

        {/* ── Pricing ────────────────────────────── */}
        <PricingSection isLoggedIn={Boolean(user)} />

        {/* ── Footer ─────────────────────────────── */}
        <footer className="border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.5fr_1fr]">
              <div className="max-w-sm">
                <Link
                  href="/"
                  className="mb-6 flex items-center gap-2.5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span className="text-lg font-semibold text-foreground">
                    NestDesk
                  </span>
                </Link>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Modern management software for PGs, colives, hostels, and
                  rental properties. Simple, practical, and easy to use.
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Data stored in India &middot; Supabase (Mumbai region)
                </p>
              </div>

              <div className="grid gap-10 sm:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    Contact
                  </h4>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p>
                        3/45 Vikrant Khand, Gomtinagar, Lucknow, Uttar
                        Pradesh, India
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 text-primary" />
                      <Link
                        href="tel:+917081335246"
                        className="transition-colors hover:text-foreground"
                      >
                        +91 70813 35246
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    Legal
                  </h4>
                  <LegalPolicyLauncher />
                </div>
              </div>
            </div>

            <Separator className="my-10" />

            <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
              <span>
                &copy; {new Date().getFullYear()} NestDesk. All rights
                reserved.
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Made in India
              </span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
