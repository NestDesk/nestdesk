"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Receipt,
  Users,
  FileText,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  ChevronDown,
  Phone,
  UserCog,
  Building2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { PropertyDangerZone } from "../hostels/PropertyDangerZone";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

// ── Types ──────────────────────────────────────────────────────────────────────

type Hostel = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  property_type: string;
  is_active: boolean;
};

type BillingData = {
  gst_number?: string | null;
  pan_number?: string | null;
  business_name?: string | null;
  billing_address?: string | null;
};

type PropertyBillingData = BillingData & {
  name: string;
  address: string;
};

function formatPropertyAddress(property: Hostel) {
  return [property.address, property.city, property.state, property.pincode]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
}

type TermsEntry = { hostel_id: string; content: string; is_default: boolean };

type StaffMember = {
  id: string;
  name: string;
  phone: string;
  designation: string;
  hostel_id: string | null;
};

interface SettingsClientProps {
  properties: Hostel[];
}

// ── Generic sample terms template ─────────────────────────────────────────────

function getDefaultTerms(hostelName: string): string {
  return `TERMS AND CONDITIONS FOR TENANTS
Property: ${hostelName}

1. TENANCY AGREEMENT
By accepting accommodation at this property, the tenant agrees to abide by all rules and regulations set forth in this document.

2. RENT PAYMENT
- Rent is due on or before the 5th of every month.
- A late fee may be charged for payments received after the due date.
- All Payments must be made directly to the owner as agreed.

3. ACCOMMODATION RULES
- Guests are allowed only with prior permission from the owner/manager.
- Overnight guests are not permitted without explicit written approval.
- Noise must be kept to a minimum, especially between 10 PM and 7 AM.
- Common areas must be kept clean and tidy at all times.

4. UTILITIES & AMENITIES
- Electricity and water charges will be billed as per actual usage or as mutually agreed.
- Any damage to property due to misuse will be charged to the tenant.
- Appliances/amenities provided are for shared use and must be treated with care.

5. SECURITY DEPOSIT
- A refundable security deposit is required at the time of move-in.
- The deposit will be returned within 30 days of vacating, after deducting any dues or damages.

6. NOTICE PERIOD
- A minimum of 30 days written notice is required before vacating the premises.
- Failure to provide adequate notice may result in forfeiture of the security deposit.

7. PROHIBITED ACTIVITIES
- Ragging, Smoking, consumption of alcohol, or any illegal activities are strictly prohibited on the premises.
- Sub-letting or transferring occupancy to another person is not allowed.
- Pets are not allowed unless explicitly permitted by the owner.
  
8. MAINTENANCE
- Routine maintenance requests must be raised through the NestDesk platform.
- Tenants must report any damage or malfunction immediately to avoid further deterioration.

9. ENTRY & INSPECTION
- The owner/manager reserves the right to inspect the premises with reasonable prior notice.
- Emergency situations may require immediate entry without prior notice.

10. TERMINATION
- The tenancy may be terminated by either party with 30 days written notice.
- Serious violations of these terms may result in immediate termination without notice.

---

By continuing to reside at this property, the tenant acknowledges having read and agreed to these terms and conditions.`;
}

// ── Billing Section ────────────────────────────────────────────────────────────

function buildPropertyBillingMap(
  properties: Hostel[],
): Record<string, PropertyBillingData> {
  return properties.reduce<Record<string, PropertyBillingData>>((acc, property) => {
    const fullAddress = formatPropertyAddress(property);
    acc[property.id] = {
      name: property.name,
      address: fullAddress,
      gst_number: null,
      pan_number: null,
      business_name: property.name,
      billing_address: fullAddress,
    };
    return acc;
  }, {});
}

function BillingSection({ properties }: { properties: Hostel[] }) {
  const [billingMap, setBillingMap] = useState<Record<string, PropertyBillingData>>(
    () => buildPropertyBillingMap(properties),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(properties[0]?.id ?? "");

  useEffect(() => {
    setBillingMap((prev) => {
      const next = buildPropertyBillingMap(properties);
      for (const property of properties) {
        if (prev[property.id]) {
          const fullAddress = formatPropertyAddress(property);
          next[property.id] = {
            ...next[property.id],
            ...prev[property.id],
            name: property.name,
            address: fullAddress,
          };
        }
      }
      return next;
    });

    if (!properties.some((property) => property.id === activeTab)) {
      setActiveTab(properties[0]?.id ?? "");
    }
  }, [properties, activeTab]);

  useEffect(() => {
    if (properties.length === 0) {
      setLoading(false);
      return;
    }

    async function fetchBilling() {
      try {
        const res = await fetch("/api/settings/property-billing");
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status}`);
        }
        const d = await res.json();
        setBillingMap((prev) => {
          const next = { ...prev };
          for (const property of properties) {
            const fullAddress = formatPropertyAddress(property);
            next[property.id] = {
              ...prev[property.id],
              name: property.name,
              address: fullAddress,
              business_name:
                d[property.id]?.business_name ??
                prev[property.id]?.business_name ??
                property.name,
              billing_address:
                d[property.id]?.billing_address ??
                prev[property.id]?.billing_address ??
                fullAddress ??
                "",
              gst_number:
                d[property.id]?.gst_number ?? prev[property.id]?.gst_number ?? null,
              pan_number:
                d[property.id]?.pan_number ?? prev[property.id]?.pan_number ?? null,
            };
          }
          return next;
        });
      } catch (err) {
        console.error("Failed to fetch billing:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchBilling();
  }, [properties]);

  async function saveBilling() {
    const current = billingMap[activeTab];
    if (!current) return;

    setSavingId(activeTab);
    const res = await fetch("/api/settings/property-billing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostel_id: activeTab,
        gst_number: current.gst_number,
        pan_number: current.pan_number,
        business_name: current.business_name,
        billing_address: current.billing_address,
      }),
    });
    setSavingId(null);
    if (res.ok) {
      toast.success("Billing details saved.");
    } else {
      const err = await res.json();
      toast.error(err?.error ?? "Failed to save.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No properties found. Add a property to manage billing details.
      </p>
    );
  }

  const current = billingMap[activeTab];

  return (
    <div className="space-y-4">
      {/* Property Tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {properties.map((prop) => (
          <button
            key={prop.id}
            onClick={() => setActiveTab(prop.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === prop.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {prop.name}
          </button>
        ))}
      </div>

      {/* Billing Form */}
      {current && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                GST Number{" "}
                <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. 22AAAAA0000A1Z5"
                maxLength={15}
                value={current.gst_number ?? ""}
                onChange={(e) =>
                  setBillingMap((p) => ({
                    ...p,
                    [activeTab]: {
                      ...p[activeTab],
                      gst_number: e.target.value || null,
                    },
                  }))
                }
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                PAN Number{" "}
                <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. AAAAA0000A"
                maxLength={10}
                value={current.pan_number ?? ""}
                onChange={(e) =>
                  setBillingMap((p) => ({
                    ...p,
                    [activeTab]: {
                      ...p[activeTab],
                      pan_number: e.target.value || null,
                    },
                  }))
                }
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Business / Trade Name
            </Label>
            <Input
              placeholder="Registered business name"
              maxLength={120}
              value={current.business_name ?? ""}
              onChange={(e) =>
                setBillingMap((p) => ({
                  ...p,
                  [activeTab]: {
                    ...p[activeTab],
                    business_name: e.target.value || null,
                  },
                }))
              }
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Billing Address</Label>
            <Textarea
              placeholder="Street, City, State, PIN"
              rows={2}
              maxLength={300}
              value={current.billing_address ?? ""}
              onChange={(e) =>
                setBillingMap((p) => ({
                  ...p,
                  [activeTab]: {
                    ...p[activeTab],
                    billing_address: e.target.value || null,
                  },
                }))
              }
              className="text-sm resize-none"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={saveBilling}
              disabled={savingId === activeTab}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {savingId === activeTab ? "Saving…" : "Save Billing Details"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Terms Section ──────────────────────────────────────────────────────────────

function TermsSection({ properties }: { properties: Hostel[] }) {
  const [termsMap, setTermsMap] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(properties[0]?.id ?? "");

  useEffect(() => {
    if (properties.length === 0) {
      setLoading(false);
      return;
    }
    fetch("/api/settings/property-terms")
      .then((r) => r.json())
      .then((data: TermsEntry[]) => {
        const map: Record<string, string> = {};
        for (const entry of data) {
          map[entry.hostel_id] = entry.content;
        }
        setTermsMap(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [properties]);

  async function saveTerms(hostelId: string) {
    const hostel = properties.find((p) => p.id === hostelId);
    const content =
      termsMap[hostelId] ?? getDefaultTerms(hostel?.name ?? "Property");
    setSavingId(hostelId);
    const res = await fetch("/api/settings/property-terms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostel_id: hostelId, content }),
    });
    setSavingId(null);
    if (res.ok) {
      toast.success("Terms saved.");
      setTermsMap((p) => ({ ...p, [hostelId]: content }));
    } else {
      const err = await res.json();
      toast.error(err?.error ?? "Failed to save.");
    }
  }

  function getTermsContent(hostelId: string, hostelName: string) {
    return termsMap[hostelId] ?? getDefaultTerms(hostelName);
  }

  if (properties.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No properties found. Add a property first.
      </p>
    );
  }

  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted/50" />;
  }

  return (
    <div className="space-y-3">
      {/* Property tabs */}
      {properties.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {properties.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveTab(p.id)}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === p.id
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Editor for the active property */}
      {properties
        .filter((p) => properties.length === 1 || p.id === activeTab)
        .map((p) => (
          <div key={p.id} className="space-y-2">
            {/* Disclaimer banner */}
            {(!termsMap[p.id] || termsMap[p.id] === "") && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sample / default terms are shown below. Customize them for{" "}
                  <span className="font-medium">{p.name}</span> and save.
                </p>
              </div>
            )}
            <Textarea
              rows={16}
              className="font-mono text-xs leading-relaxed resize-y"
              value={getTermsContent(p.id, p.name)}
              onChange={(e) =>
                setTermsMap((prev) => ({ ...prev, [p.id]: e.target.value }))
              }
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => saveTerms(p.id)}
                disabled={savingId === p.id}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                {savingId === p.id ? "Saving…" : `Save Terms for ${p.name}`}
              </Button>
            </div>
          </div>
        ))}
    </div>
  );
}

// ── Support Staff Section ──────────────────────────────────────────────────────

function SupportStaffSection({ properties }: { properties: Hostel[] }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    designation: "",
    hostel_id: "" as string,
  });
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadStaff = useCallback(async () => {
    const res = await fetch("/api/settings/support-staff");
    if (res.ok) {
      const data = await res.json();
      setStaff(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  async function addStaff() {
    if (!form.name.trim() || !form.phone.trim() || !form.designation.trim()) {
      toast.error("Name, phone, and designation are required.");
      return;
    }
    if (!/^\d{10}$/.test(form.phone)) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }
    setAdding(true);
    const res = await fetch("/api/settings/support-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        hostel_id: form.hostel_id || null,
      }),
    });
    setAdding(false);
    if (res.ok) {
      const newMember = await res.json();
      setStaff((p) => [...p, newMember]);
      setForm({ name: "", phone: "", designation: "", hostel_id: "" });
      setShowForm(false);
      toast.success("Staff member added.");
    } else {
      const err = await res.json();
      toast.error(err?.error ?? "Failed to add.");
    }
  }

  async function deleteStaff(id: string) {
    setDeletingId(id);
    const res = await fetch(`/api/settings/support-staff?id=${id}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    if (res.ok) {
      setStaff((p) => p.filter((s) => s.id !== id));
      toast.success("Staff member removed.");
    } else {
      toast.error("Failed to remove.");
    }
  }

  if (loading) {
    return <div className="h-20 animate-pulse rounded-lg bg-muted/50" />;
  }

  const hostelName = (id: string | null) =>
    properties.find((p) => p.id === id)?.name ?? "All Properties";

  return (
    <div className="space-y-4">
      {/* Staff list */}
      {staff.length > 0 ? (
        <div className="space-y-2">
          {staff.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserCog className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {s.name}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {s.phone}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{s.designation}</span>
                  {s.hostel_id && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {hostelName(s.hostel_id)}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteStaff(s.id)}
                disabled={deletingId === s.id}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <p className="text-sm text-muted-foreground">
            No support staff added yet.
          </p>
        )
      )}

      {/* Add form */}
      {showForm ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Add Staff Member</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full Name</Label>
              <Input
                placeholder="e.g. Ramesh Kumar"
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone Number</Label>
              <Input
                placeholder="10-digit number"
                maxLength={10}
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    phone: e.target.value.replace(/\D/g, ""),
                  }))
                }
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Designation</Label>
              <Input
                placeholder="e.g. Warden, Caretaker, Security"
                maxLength={60}
                value={form.designation}
                onChange={(e) =>
                  setForm((p) => ({ ...p, designation: e.target.value }))
                }
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Property <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <select
                value={form.hostel_id}
                onChange={(e) =>
                  setForm((p) => ({ ...p, hostel_id: e.target.value }))
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              >
                <option value="">All Properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={addStaff}
              disabled={adding}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {adding ? "Adding…" : "Add Staff"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Staff Member
        </Button>
      )}
    </div>
  );
}

// ── Property Management Section ────────────────────────────────────────────────

function PropertyManagementSection({ properties }: { properties: Hostel[] }) {
  if (properties.length === 0) {
    return (
      <Card className="rounded-2xl border-border/70">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            No properties found. Add a property first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {properties.map((property) => (
        <Card key={property.id} className="rounded-2xl border-border/70 bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {property.name}
              </CardTitle>
              <Badge variant={property.is_active ? "default" : "secondary"}>
                {property.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <PropertyDangerZone
              hostelId={property.id}
              hostelName={property.name}
              isActive={property.is_active}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main SettingsClient ────────────────────────────────────────────────────────

export function SettingsClient({ properties }: SettingsClientProps) {
  return (
    <div className="space-y-3">
      <Accordion type="multiple" className="space-y-3">
        {/* Billing Details */}
        <AccordionItem
          value="billing"
          className="rounded-2xl border border-border/70 bg-card/80 px-5 shadow-sm"
        >
          <AccordionTrigger className="py-4 hover:no-underline [&>svg]:hidden">
            <div className="flex w-full items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Receipt className="h-4 w-4" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">
                  Billing Details
                </p>
                <p className="text-xs text-muted-foreground">
                  GST number, PAN, and billing address
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5 pt-1">
            <Separator className="mb-4" />
            <BillingSection properties={properties} />
          </AccordionContent>
        </AccordionItem>

        {/* Property Terms */}
        <AccordionItem
          value="terms"
          className="rounded-2xl border border-border/70 bg-card/80 px-5 shadow-sm"
        >
          <AccordionTrigger className="py-4 hover:no-underline [&>svg]:hidden">
            <div className="flex w-full items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <FileText className="h-4 w-4" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">
                  Terms & Conditions
                </p>
                <p className="text-xs text-muted-foreground">
                  Set tenancy terms per property — visible to tenants
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5 pt-1">
            <Separator className="mb-4" />
            <TermsSection properties={properties} />
          </AccordionContent>
        </AccordionItem>

        {/* Support Staff */}
        <AccordionItem
          value="staff"
          className="rounded-2xl border border-border/70 bg-card/80 px-5 shadow-sm"
        >
          <AccordionTrigger className="py-4 hover:no-underline [&>svg]:hidden">
            <div className="flex w-full items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <Users className="h-4 w-4" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">
                  Support Staff
                </p>
                <p className="text-xs text-muted-foreground">
                  Add caretakers, wardens, and contact numbers
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5 pt-1">
            <Separator className="mb-4" />
            <SupportStaffSection properties={properties} />
          </AccordionContent>
        </AccordionItem>

        {/* Property Management */}
        <AccordionItem
          value="properties"
          className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 shadow-sm"
        >
          <AccordionTrigger className="py-4 hover:no-underline [&>svg]:hidden">
            <div className="flex w-full items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">
                  Property Management
                </p>
                <p className="text-xs text-muted-foreground">
                  Deactivate or permanently delete a property
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-5 pt-1">
            <Separator className="mb-4" />
            <PropertyManagementSection properties={properties} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
