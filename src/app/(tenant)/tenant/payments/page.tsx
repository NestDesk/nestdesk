import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreditCard, IndianRupee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  paid: "default",
  pending: "secondary",
  overdue: "destructive",
  disputed: "outline",
};

function formatMonth(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function TenantPaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!tenant) redirect("/login");

  const { data: payments } = await admin
    .from("payments")
    .select("id, month, amount, status, method, paid_at, receipt_number")
    .eq("tenant_id", tenant.id)
    .order("month", { ascending: false });

  const rows = payments ?? [];

  const totalPaid = rows
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Payment History
        </h1>
        <p className="text-muted-foreground">All your rent payments in one place.</p>
      </div>

      {/* Summary */}
      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <IndianRupee className="h-4 w-4" />
            Total paid
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-foreground">
            {formatAmount(totalPaid)}
          </p>
        </CardContent>
      </Card>

      {/* Payment list */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <CreditCard className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No payment records yet.</p>
          <p className="text-xs text-muted-foreground">
            Payments recorded by your property owner will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <Card key={p.id} className="rounded-2xl border-border/70">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {formatMonth(p.month)}
                  </p>
                  {p.receipt_number && (
                    <p className="text-xs text-muted-foreground">
                      Receipt: {p.receipt_number}
                    </p>
                  )}
                  {p.paid_at && (
                    <p className="text-xs text-muted-foreground">
                      Paid on {new Date(p.paid_at).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-foreground">
                    {formatAmount(Number(p.amount))}
                  </span>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>
                    {p.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
