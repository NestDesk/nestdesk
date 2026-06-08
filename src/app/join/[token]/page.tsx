import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, MapPin, Home, CheckCircle2 } from "lucide-react";
import { createAdminClient } from "../../../lib/supabase/admin";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

type Props = {
  params: Promise<{ token: string }> | { token: string };
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  pg: "PG / Paying Guest",
  hostel: "Hostel",
  coliving: "Co-living Space",
  rental: "Rental Property",
};

export default async function TenantJoinPage({ params }: Props) {
  const { token } = await Promise.resolve(params);

  if (!token || token.length > 64) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: hostel, error } = await admin
    .from("hostels")
    .select("id, name, property_type, address, city, state, is_active")
    .eq("tenant_join_token", token)
    .maybeSingle();

  if (error || !hostel || !hostel.is_active) {
    notFound();
  }

  const registerHref = `/tenant/register?token=${token}&hostel=${hostel.id}`;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <div className="mb-8 flex items-center gap-2 text-foreground">
        <Building2 className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold tracking-tight">NestDesk</span>
      </div>

      <Card className="w-full max-w-md rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Home className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl leading-snug">{hostel.name}</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {PROPERTY_TYPE_LABELS[hostel.property_type] ?? hostel.property_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              {hostel.address}, {hostel.city}, {hostel.state}
            </span>
          </div>

          <Badge variant="secondary" className="w-fit">
            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
            Accepting registrations
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground leading-relaxed">
            Create your account to complete your room rental registration with{" "}
            <span className="font-medium text-foreground">{hostel.name}</span>.
          </div>

          <Button asChild className="w-full rounded-xl" size="lg">
            <Link href={registerHref}>Create Tenant Account</Link>
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link
              href={`/login?token=${token}&hostel=${hostel.id}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground text-center max-w-xs">
        This is an official invite link shared by the property owner. Your
        information will only be used for rental management purposes.
      </p>
    </div>
  );
}
