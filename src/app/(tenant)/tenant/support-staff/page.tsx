"use client";

import { useEffect, useState } from "react";
import { Phone, Users, Loader2, UserCog } from "lucide-react";
import { Card, CardContent } from "../../../../components/ui/card";

type StaffMember = {
  id: string;
  name: string;
  phone: string;
  designation: string;
};

export default function TenantSupportStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenant/support-staff")
      .then((r) => r.json())
      .then((data) => {
        setStaff(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Support Staff
          </h2>
          <p className="text-sm text-muted-foreground">
            Contact information for property support and management
          </p>
        </div>
      </div>

      {/* Staff list or empty state */}
      {staff.length === 0 ? (
        <Card className="rounded-2xl border-border/70 bg-card/80">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No support staff found</p>
              <p className="text-sm text-muted-foreground">
                The property owner has not added support staff yet.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <Card
              key={member.id}
              className="rounded-xl border-border/60 bg-gradient-to-br from-card/80 to-card/40 hover:border-border/80 transition-colors"
            >
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UserCog className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {member.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.designation}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/40">
                  {/* Phone */}
                  <a
                    href={`tel:${member.phone}`}
                    className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2 text-sm transition-colors hover:bg-primary/20 hover:text-primary group"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="font-mono font-medium">{member.phone}</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
