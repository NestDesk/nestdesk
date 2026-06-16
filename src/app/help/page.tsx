import Link from "next/link";
import { ArrowLeft, Building2, CreditCard, Megaphone, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Navbar, NavbarLogo } from "../../components/layout/Navbar";
import { ThemeToggle } from "../../components/layout/ThemeToggle";
import { LandingMobileNav } from "../../components/layout/LandingMobileNav";
import { LandingAccountMenu, type LandingAccountUser } from "../../components/layout/LandingAccountMenu";
import { createClient } from "../../lib/supabase/server";

export default async function HelpPage() {
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
    <>
      <Navbar
        left={
          <>
            <LandingMobileNav user={landingUser} />
            <NavbarLogo />
          </>
        }
        center={
          <>
            <a href="/#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="/#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
            <a href="/#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            <Link href="/help" className="transition-colors hover:text-foreground">Help</Link>
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
                <Button variant="ghost" size="sm" className="rounded-xl">Sign in</Button>
              </Link>
            )}
          </>
        }
      />

      <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">NestDesk Help & workflow guide</h1>
            <p className="max-w-3xl text-muted-foreground">
              This guide explains how the product is organized, what each section does, and how owners and tenants move through the platform from setup to daily operations.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>1. How NestDesk works end to end</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The application has two main portals: the owner dashboard for property and operations management, and the tenant portal for stay-related actions. Owners create properties, rooms, and billing structure first, then tenants join and use the tenant portal for payments, notices, maintenance, and profile updates.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border p-4">1. Owners set up hostels, rooms, pricing, and subscription plan.</div>
              <div className="rounded-2xl border border-border p-4">2. Tenants register, get approved, and access their account and stay details.</div>
              <div className="rounded-2xl border border-border p-4">3. Owners and tenants use payments, notices, maintenance, and reports to run daily operations.</div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-2 text-primary"><Building2 className="h-5 w-5" /></div>
                <CardTitle>2. Owner section by section</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ul className="space-y-3">
                <li><strong>Dashboard:</strong> gives an overview of active properties, occupancy, maintenance issues, this month’s rent and expenses, and subscription status.</li>
                <li><strong>Properties / Hostels:</strong> lets owners add and manage hostel details, floors, rooms, activation state, and property access codes.</li>
                <li><strong>Tenants:</strong> helps owners review tenant applications, approve or update tenant records, assign rooms, and view rent/payment coverage.</li>
                <li><strong>Payments:</strong> is for recording and tracking rent/payment entries, filtering by hostel or tenant, and reviewing payment history.</li>
                <li><strong>Expenses:</strong> captures operational spending and recurring cost tracking for the property.</li>
                <li><strong>Notices:</strong> lets owners create, publish, and manage important announcements for tenants.</li>
                <li><strong>Maintenance:</strong> centralizes tenant problems, owner comments, status updates, and resolution tracking.</li>
                <li><strong>Reports:</strong> gives analytics on finances, occupancy, defaulters, expenses, and maintenance trends.</li>
                <li><strong>Subscriptions:</strong> handles plan upgrades, pricing, and owner billing through integrated payment flow.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-600"><UserRound className="h-5 w-5" /></div>
                <CardTitle>3. Tenant section by section</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ul className="space-y-3">
                <li><strong>Dashboard:</strong> shows account status, stay details, room information, maintenance limit, and quick access to key actions.</li>
                <li><strong>Payments:</strong> displays rent payment history, paid amounts, disputed items, and receipts.</li>
                <li><strong>Notices:</strong> shows published announcements from the owner for the tenant’s property.</li>
                <li><strong>Maintenance:</strong> lets tenants raise, edit, and delete open requests for property issues.</li>
                <li><strong>Profile:</strong> allows tenants to view and manage their personal details and supporting documents.</li>
                <li><strong>Support Staff:</strong> gives access to support contacts and service-related help information.</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>4. Detailed owner registration and property setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border p-4">
              <h2 className="mb-2 font-semibold text-foreground">Owner registration steps</h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Go to /register and create an owner account with full name, email, and a strong password.</li>
                <li>Choose your plan on the registration page; the selected plan is carried into your onboarding flow.</li>
                <li>After account creation, you land in onboarding and then enter the owner dashboard.</li>
                <li>Complete your owner profile and phone verification in the settings/profile areas so your account is trusted for tenant operations.</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <h2 className="mb-2 font-semibold text-foreground">Property setup steps</h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Open Properties and click Add Property to create your hostel or PG entry.</li>
                <li>Fill in the property name, type, full address, pincode, city, and state. Pincode lookup can auto-fill city/state.</li>
                <li>After saving, go to the property setup screen to create floors and rooms.</li>
                <li>Use the Building step to create floor shells, then the Rooms step to add room numbers, capacity, rent, and status.</li>
                <li>Review the blueprint and finalize the setup. Once the property has floors and rooms, you can activate it for tenant access.</li>
                <li>After activation, share the invite link or QR code so tenants can register against that property.</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>5. Detailed tenant registration, account setup, and activation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border p-4">
              <h2 className="mb-2 font-semibold text-foreground">Tenant registration steps</h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Open the invite link or QR code shared by the owner. This validates the property and takes you to the tenant registration page.</li>
                <li>Enter full name, email, phone, occupation type, institution name, gender, and Aadhaar details.</li>
                <li>Verify your phone number using the OTP flow sent to WhatsApp. This must be completed before the tenant account is submitted.</li>
                <li>Create your password and accept the consent terms. Once the form is submitted, the owner receives the registration for review.</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <h2 className="mb-2 font-semibold text-foreground">How tenants reach 100% activation readiness</h2>
              <ol className="list-decimal space-y-2 pl-5">
                <li>After registration, the tenant account enters the pending state until the owner approves it.</li>
                <li>On the tenant dashboard, the profile completion meter shows progress across 10 required items: full name, email, phone, occupation type, institution name, Aadhaar, profile photo, Aadhaar front, Aadhaar back, and alternate ID.</li>
                <li>To reach 100%, upload all required documents and fill all profile fields. The system marks the profile as complete when every required item is present.</li>
                <li>Once the owner approves the tenant, the status changes to active and the tenant gains full access to payments, notices, maintenance, and profile tools.</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>6. Pending vs active states</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border p-4">
                <h2 className="mb-2 font-semibold text-foreground">Pending</h2>
                <p>The tenant has created an account but is waiting for the owner to approve the registration. During this state the tenant can see the pending status and complete profile details, but full access is limited.</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <h2 className="mb-2 font-semibold text-foreground">Active</h2>
                <p>After the owner approves the tenant, the record becomes active. The tenant can access the full portal and use payments, notices, maintenance, profile, and support features.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>7. Typical workflows</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
            <div className="rounded-2xl border border-border p-4">
              <h2 className="mb-2 font-semibold text-foreground">For owners</h2>
              <p>Start by creating a property, complete room/floor setup, invite or review tenants, then use payments, notices, maintenance, and reports to keep everything running.</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <h2 className="mb-2 font-semibold text-foreground">For tenants</h2>
              <p>After approval, use your dashboard to check status, view payment history, read notices, raise maintenance requests, and manage your profile.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3"><div className="rounded-2xl bg-primary/10 p-2 text-primary"><CreditCard className="h-5 w-5" /></div><CardTitle>Payments & billing</CardTitle></div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Owners record payments and track dues; tenants view their payment history and receipts. This keeps rent collection and verification structured.</CardContent>
          </Card>
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3"><div className="rounded-2xl bg-primary/10 p-2 text-primary"><Megaphone className="h-5 w-5" /></div><CardTitle>Notices & communication</CardTitle></div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Owners publish property updates and announcements; tenants see them in their own notices section, keeping communication centralized.</CardContent>
          </Card>
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3"><div className="rounded-2xl bg-primary/10 p-2 text-primary"><Wrench className="h-5 w-5" /></div><CardTitle>Maintenance & support</CardTitle></div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Tenants create issues, owners respond and update statuses, and the system tracks open, in-progress, and resolved work.</CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3"><div className="rounded-2xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div><CardTitle>8. What to expect from the app</CardTitle></div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">NestDesk is designed to reduce manual coordination between owners and tenants. It combines property setup, occupancy tracking, financial history, notices, and maintenance into one system so both sides can operate without scattered tools.</CardContent>
        </Card>
      </section>
      </main>
    </>
  );
}
