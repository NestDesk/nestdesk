"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";

const createHostelSchema = z.object({
  hostelName: z.string().min(2, "Enter your property name."),
  propertyType: z.enum(["pg", "hostel", "coliving", "rental"], {
    message: "Select a property type.",
  }),
  address: z.string().min(5, "Enter the full address."),
  city: z.string().min(2, "Enter city."),
  state: z.string().min(2, "Enter state."),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
});

type CreateHostelForm = z.infer<typeof createHostelSchema>;

const PROPERTY_TYPES = [
  { value: "pg", label: "PG" },
  { value: "hostel", label: "Hostel" },
  { value: "coliving", label: "Co-living" },
  { value: "rental", label: "Rental" },
] as const;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground/80">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function NewPropertyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [pincodeLookupError, setPincodeLookupError] = useState<string | null>(null);
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);

  const form = useForm<CreateHostelForm>({
    resolver: zodResolver(createHostelSchema),
    defaultValues: {
      propertyType: "pg",
    },
  });

  async function lookupPincodeLocation(pincode: string) {
    if (pincode.length !== 6) {
      return;
    }

    setPincodeLookupLoading(true);
    setPincodeLookupError(null);

    try {
      const response = await fetch(`/api/pincode/${encodeURIComponent(pincode)}`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Unable to resolve this pincode.");
      }

      form.setValue("city", String(json.city ?? form.getValues("city")).trim());
      form.setValue("state", String(json.state ?? form.getValues("state")).trim());
    } catch (error) {
      setPincodeLookupError(
        error instanceof Error ? error.message : "Unable to resolve this pincode.",
      );
    } finally {
      setPincodeLookupLoading(false);
    }
  }

  async function onSubmit(values: CreateHostelForm) {
    setSaving(true);
    try {
      const res = await fetch("/api/hostels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Could not create property.");
        if (res.status === 409) {
          router.push("/onboarding");
        }
        return;
      }

      toast.success(
        "Property created as inactive. Complete floor plan to activate.",
      );
      router.refresh();
      router.push(json.redirectTo ?? "/hostels");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Add Property
          </h2>
          <p className="text-muted-foreground">
            Create a new property under your account.
          </p>
        </div>

        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/hostels">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Field
              label="Property name"
              error={form.formState.errors.hostelName?.message}
            >
              <Input
                placeholder="Sunrise PG for Boys"
                {...form.register("hostelName")}
              />
            </Field>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground/80">
                Property type
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROPERTY_TYPES.map((pt) => (
                  <label key={pt.value} className="cursor-pointer">
                    <input
                      type="radio"
                      value={pt.value}
                      className="peer sr-only"
                      {...form.register("propertyType")}
                    />
                    <div className="rounded-xl border border-input bg-background px-2 py-2 text-center text-xs font-medium text-muted-foreground transition-all peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground hover:border-foreground/30">
                      {pt.label}
                    </div>
                  </label>
                ))}
              </div>
              {form.formState.errors.propertyType && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.propertyType.message}
                </p>
              )}
            </div>

            <Field
              label="Full address"
              error={form.formState.errors.address?.message}
            >
              <Input
                placeholder="Plot 12, Sector 5, Near Station"
                {...form.register("address")}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field
                label="Pincode"
                error={
                  form.formState.errors.pincode?.message ||
                  pincodeLookupError ||
                  undefined
                }
              >
                <Input
                  type="tel"
                  placeholder="400001"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  {...form.register("pincode", {
                    setValueAs: (value) =>
                      String(value ?? "")
                        .replace(/\D/g, "")
                        .slice(0, 6),
                    onChange: (event) => {
                      const target = event.target as HTMLInputElement;
                      const digits = target.value.replace(/\D/g, "").slice(0, 6);
                      target.value = digits;
                      if (digits.length === 6) {
                        lookupPincodeLocation(digits);
                      }
                    },
                  })}
                />
                {pincodeLookupLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Loading city and state…
                  </p>
                ) : null}
              </Field>
              <Field label="City" error={form.formState.errors.city?.message}>
                <Input placeholder="Mumbai" {...form.register("city")} />
              </Field>
              <Field label="State" error={form.formState.errors.state?.message}>
                <Input placeholder="Maharashtra" {...form.register("state")} />
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" className="rounded-xl" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Building2 className="mr-2 h-4 w-4" />
                    Create Property
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
