import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, CreditCard, Megaphone, UserRound, Wrench } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Navbar, NavbarLogo } from "../../components/layout/Navbar";
import { ThemeToggle } from "../../components/layout/ThemeToggle";
import { LandingMobileNav } from "../../components/layout/LandingMobileNav";
import { LandingAccountMenu, type LandingAccountUser } from "../../components/layout/LandingAccountMenu";
import { createClient } from "../../lib/supabase/server";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Find guides and answers for managing your PG or hostel with NestDesk — from tenant onboarding to rent and maintenance.",
  alternates: { canonical: "/help" },
};

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
            <Link href="/#demo" className="transition-colors hover:text-foreground">Demo</Link>
            <Link href="/#features" className="transition-colors hover:text-foreground">Features</Link>
            <Link href="/#how-it-works" className="transition-colors hover:text-foreground">How it works</Link>
            <Link href="/#pricing" className="transition-colors hover:text-foreground">Pricing</Link>
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

      <main className="min-h-screen bg-background text-foreground pb-20">
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Link>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">NestDesk Help & Documentation</h1>
              <p className="max-w-3xl text-muted-foreground">
                Comprehensive guide to exactly how the platform works for Property Owners and Tenants. Learn how to register, configure your properties, raise maintenance requests, and manage rent.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/login">Sign in to your account</Link>
            </Button>
          </div>

          <div className="space-y-12">
            {/* Owners Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold">Property Owners Guide</h2>
              </div>

              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">1. Owner Registration & Onboarding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>Starting as an owner requires passing our multi-step verification process to ensure a secure platform for tenants.</p>
                  <div className="rounded-xl border border-border p-4 bg-muted/20">
                    <ul className="list-decimal list-inside space-y-2">
                      <li><strong>Account Creation:</strong> Visit <code className="bg-muted px-1.5 py-0.5 rounded">/register</code>. Provide your full name (no numbers allowed), email, and a strong password. A strong password requires at least 8 characters, an uppercase letter, a lowercase letter, and a number.</li>
                      <li><strong>Plan Selection:</strong> Choose your software tier (e.g., Free, Starter, Pro) during registration. This plan follows you through your account lifecycle.</li>
                      <li><strong>Onboarding Profile:</strong> Once registered, you must provide your property business or home address. Simply entering your 6-digit Pincode will automatically detect and fill your City and State.</li>
                      <li><strong>WhatsApp Phone Verification:</strong> Enter your 10-digit mobile number. You will receive an OTP via WhatsApp. This step must be completed to unlock a verified owner dashboard, proving your identity to prospective tenants.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">2. Property Setup & Invite Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>Your dashboard will be mostly empty until you create a property structure.</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border p-4">
                      <h4 className="font-semibold text-foreground mb-1 mt-0">Add a Hostel/PG</h4>
                      <p>Navigate to <strong>Hostels</strong> and fill in the facility name, type (PG, Hostel, rental), and full address. Once saved, it will be listed as &apos;Setup Incomplete&apos;.</p>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <h4 className="font-semibold text-foreground mb-1 mt-0">Create Rooms</h4>
                      <p>Click into the property to build &apos;Floors&apos;, and then generate &apos;Rooms&apos;. Set the rent values and capacity for each bed space.</p>
                    </div>
                  </div>
                  <p className="bg-primary/5 text-primary p-3 rounded-xl border border-primary/20">
                    <strong>Crucial:</strong> Activating the property generates a specific <strong>Invite Link</strong> and <strong>QR Code</strong>. Give this link to your tenants so they apply directly to your property database.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">3. Owner Platform Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <ul className="grid gap-3 md:grid-cols-2">
                    <li className="flex gap-2"><div className="text-primary mt-0.5">•</div><div><strong>Dashboard:</strong> Overviews of occupancy limits, this month&apos;s rent collected vs pending, total expenses, and open maintenance tickets.</div></li>
                    <li className="flex gap-2"><div className="text-primary mt-0.5">•</div><div><strong>Tenants:</strong> Review incoming requests from your Invite link. Approve tenants, assign rooms, update their billing dates.</div></li>
                    <li className="flex gap-2"><div className="text-primary mt-0.5">•</div><div><strong>Payments:</strong> Log cash or UPI rent collections. View historical payment records and filter by tenant or hostel.</div></li>
                    <li className="flex gap-2"><div className="text-primary mt-0.5">•</div><div><strong>Expenses:</strong> Track your operational costs (Electricity, Staff Salary, Repairs) against your income.</div></li>
                      <li className="flex gap-2"><div className="text-primary mt-0.5">•</div><div><strong>Maintenance:</strong> View tickets raised by tenants. Update statuses to &quot;In Progress&quot; or &quot;Resolved&quot;, leaving comments.</div></li>
                    <li className="flex gap-2"><div className="text-primary mt-0.5">•</div><div><strong>Notices:</strong> Publish important announcements internally. Tenants see these in their dashboard instantly, avoiding WhatsApp clutter.</div></li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Tenants Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-600">
                  <UserRound className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold">Tenant Operations Guide</h2>
              </div>

              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">1. Registration through Invite Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>Tenants cannot join in a vacuum. You must scan the owner&apos;s QR code or click their Invitation Link. This ensures you are tied straight to their specific PG/Hostel database.</p>
                  <div className="rounded-xl border border-border p-4 bg-muted/20">
                    <ol className="list-decimal list-inside space-y-2">
                      <li>Open the owner&apos;s invite link. It will show the property name and confirm it is accepting registrations.</li>
                      <li>Fill out your full name, email, phone number, gender, and Aadhaar info.</li>
                      <li>Complete WhatsApp OTP verification to prove your mobile number.</li>
                      <li>Set your password and enter the system.</li>
                    </ol>
                  </div>
                  <p className="bg-amber-500/5 text-amber-600 p-3 rounded-xl border border-amber-500/20">
                    <strong>Pending State:</strong> Upon registration, your account is in a &quot;Pending&quot; state. You have access to your dashboard, but features are locked until the owner approves your join request.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">2. Hitting 100% Profile Completion</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>Even if the owner approves you, you must fill out 10 distinct profile fields in the <strong>Profile</strong> tab to reach full Active status.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Full Name</li>
                      <li>Email Address</li>
                      <li>Phone Number</li>
                      <li>Occupation Type</li>
                      <li>Workplace/Institution Name</li>
                    </ul>
                    <ul className="list-disc list-inside space-y-1">
                      <li>12-Digit Aadhaar Number</li>
                      <li>Profile Photo Upload</li>
                      <li>Aadhaar Front Image</li>
                      <li>Aadhaar Back Image</li>
                      <li>Alternate ID Document</li>
                    </ul>
                  </div>
                  <p>Once all 10 inputs are provided, the progress meter reads 100% and you are fully unlocked!</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">3. Tenant Features (Maintenance, Notices, and Payments)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div className="space-y-5">
                    <div className="rounded-xl border border-border p-4 hover:border-cyan-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="h-5 w-5 text-cyan-600" />
                        <h4 className="font-semibold text-foreground mt-0 mb-0">Raising Maintenance Requests</h4>
                      </div>
                      <p>If something breaks (e.g. WiFi, Plumbing, Fan), go to the <strong>Maintenance</strong> tab. Click &quot;New Request&quot;, select the category, give it a short title, and describe the issue.</p>
                      <ul className="ml-5 list-disc mt-2 text-xs">
                        <li>The owner is immediately notified.</li>
                        <li>Track whether the issue is &apos;Open&apos;, &apos;In Progress&apos;, or &apos;Resolved&apos;.</li>
                        <li>Delete or modify your request if the problem resolves on its own.</li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-border p-4 hover:border-cyan-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Megaphone className="h-5 w-5 text-cyan-600" />
                        <h4 className="font-semibold text-foreground mt-0 mb-0">Viewing Property Notices</h4>
                      </div>
                      <p>Forget messy group chats. Under the <strong>Notices</strong> tab, you can read formatted, official announcements from the owner (e.g., &apos;Water supply offline tomorrow&apos;, &apos;Rent Policy Updates&apos;).</p>
                    </div>

                    <div className="rounded-xl border border-border p-4 hover:border-cyan-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="h-5 w-5 text-cyan-600" />
                        <h4 className="font-semibold text-foreground mt-0 mb-0">Tracking Rent & Payments</h4>
                      </div>
                      <p>The <strong>Payments</strong> section gives you an immutable history of every rent payment made. See exactly which months are paid and which are listed as pending, keeping the record straight between you and the owner.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
