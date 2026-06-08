"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

type InstitutionSalesLeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const initialFormState = {
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  institutionName: "",
  propertyCount: "",
  tenantCount: "",
  preferredTimelineYears: "0",
  preferredTimelineMonths: "0",
  preferredTimeline: "",
};

type InstitutionLeadForm = typeof initialFormState;

const formatPreferredTimeline = (years: string, months: string) => {
  const parsedYears = Number(years);
  const parsedMonths = Number(months);

  if (!Number.isFinite(parsedYears) || parsedYears < 0) {
    return "";
  }

  if (!Number.isFinite(parsedMonths) || parsedMonths < 0) {
    return "";
  }

  const parts: string[] = [];
  if (parsedYears > 0) {
    parts.push(`${parsedYears} year${parsedYears === 1 ? "" : "s"}`);
  }

  if (parsedMonths > 0) {
    parts.push(`${parsedMonths} month${parsedMonths === 1 ? "" : "s"}`);
  }

  return parts.join(" ");
};

export function InstitutionSalesLeadDialog({
  open,
  onOpenChange,
}: InstitutionSalesLeadDialogProps) {
  const [form, setForm] = useState<InstitutionLeadForm>(initialFormState);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof InstitutionLeadForm, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof InstitutionLeadForm, value: string) => {
    setForm((current) => {
      let nextValue = value;

      if (field === "contactPhone") {
        nextValue = value.replace(/\D/g, "").slice(0, 10);
      }

      const nextForm = { ...current, [field]: nextValue };
      if (
        field === "preferredTimelineYears" ||
        field === "preferredTimelineMonths"
      ) {
        nextForm.preferredTimeline = formatPreferredTimeline(
          field === "preferredTimelineYears"
            ? nextValue
            : current.preferredTimelineYears,
          field === "preferredTimelineMonths"
            ? nextValue
            : current.preferredTimelineMonths,
        );
      }
      return nextForm;
    });
    setFormErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === "preferredTimelineYears" || field === "preferredTimelineMonths"
        ? { preferredTimeline: undefined }
        : {}),
    }));
  };

  const validateForm = () => {
    const errors: Partial<Record<keyof InstitutionLeadForm, string>> = {};

    if (!form.contactName.trim()) {
      errors.contactName = "Contact name is required.";
    } else if (!/^[A-Za-z ]+$/.test(form.contactName.trim())) {
      errors.contactName =
        "Contact name can only contain English letters and spaces.";
    }

    if (!form.contactEmail.trim()) {
      errors.contactEmail = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) {
      errors.contactEmail = "Enter a valid email address.";
    }

    if (!form.contactPhone.trim()) {
      errors.contactPhone = "Phone number is required.";
    } else {
      const digitsOnly = form.contactPhone.replace(/\D/g, "");
      if (digitsOnly.length !== 10) {
        errors.contactPhone = "Phone number must be exactly 10 digits.";
      }
    }

    if (
      form.institutionName.trim().length > 0 &&
      form.institutionName.trim().length < 2
    ) {
      errors.institutionName = "Institution name must be at least 2 characters.";
    }

    if (!form.propertyCount.trim()) {
      errors.propertyCount = "Property count is required.";
    } else {
      const parsed = Number(form.propertyCount);
      if (!Number.isInteger(parsed) || parsed < 0) {
        errors.propertyCount = "Property count must be a non-negative integer.";
      }
    }

    if (!form.tenantCount.trim()) {
      errors.tenantCount = "Tenant count is required.";
    } else {
      const parsed = Number(form.tenantCount);
      if (!Number.isInteger(parsed) || parsed < 0) {
        errors.tenantCount = "Tenant count must be a non-negative integer.";
      }
    }

    const years = Number(form.preferredTimelineYears);
    const months = Number(form.preferredTimelineMonths);
    const timelineValue = formatPreferredTimeline(
      form.preferredTimelineYears,
      form.preferredTimelineMonths,
    );

    if (Number.isNaN(years) || years < 0) {
      errors.preferredTimeline = "Enter a valid subscription duration.";
    } else if (Number.isNaN(months) || months < 0 || months > 11) {
      errors.preferredTimeline = "Enter a valid subscription duration.";
    } else if (years === 0 && months === 0) {
      errors.preferredTimeline = "Preferred timeline must be at least 1 month.";
    } else if (!timelineValue) {
      errors.preferredTimeline = "Enter a valid subscription duration.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleClose = () => {
    setSubmitted(false);
    setForm(initialFormState);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/institution-sales-leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          institutionName: form.institutionName.trim() || undefined,
          propertyCount: form.propertyCount ? Number(form.propertyCount) : undefined,
          tenantCount: form.tenantCount ? Number(form.tenantCount) : undefined,
          preferredTimeline: formatPreferredTimeline(
            form.preferredTimelineYears,
            form.preferredTimelineMonths,
          ),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to submit your request.");
      }

      setSubmitted(true);
      toast.success(
        "Your request has been submitted. Our sales representative will reach out to you soon.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit your request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyPhoneNumber = () => {
    const digitsOnly = form.contactPhone.replace(/\D/g, "");
    if (digitsOnly.length === 10) {
      toast.success("Phone number looks valid.");
      setFormErrors((current) => ({ ...current, contactPhone: undefined }));
    } else {
      setFormErrors((current) => ({
        ...current,
        contactPhone: "Phone number must be exactly 10 digits.",
      }));
      toast.error("Please enter a valid 10-digit phone number.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSubmitted(false);
          setForm(initialFormState);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="w-[min(32rem,100vw)] p-5">
        <DialogHeader>
          <DialogTitle>Contact Sales</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            Share the key details of your institution so we can follow up with a
            custom rollout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          {submitted ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <p className="font-semibold">Request submitted</p>
              <p className="mt-2 text-sm">
                Thank you! Your request has been submitted and our sales
                representative will reach out to you shortly.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="lead-contact-name">Contact name</Label>
                <Input
                  id="lead-contact-name"
                  value={form.contactName}
                  onChange={(event) =>
                    handleChange("contactName", event.target.value)
                  }
                />
                {formErrors.contactName ? (
                  <p className="text-xs text-destructive">
                    {formErrors.contactName}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="lead-contact-email">Email</Label>
                <Input
                  id="lead-contact-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) =>
                    handleChange("contactEmail", event.target.value)
                  }
                />
                {formErrors.contactEmail ? (
                  <p className="text-xs text-destructive">
                    {formErrors.contactEmail}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="lead-contact-phone">Phone</Label>
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-background pl-3">
                    <span className="text-sm text-foreground/80">+91</span>
                    <Input
                      id="lead-contact-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.contactPhone}
                      onChange={(event) =>
                        handleChange("contactPhone", event.target.value)
                      }
                      className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0 pl-2"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={verifyPhoneNumber}
                    className="whitespace-nowrap"
                  >
                    Verify
                  </Button>
                </div>
                {formErrors.contactPhone ? (
                  <p className="text-xs text-destructive">
                    {formErrors.contactPhone}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="lead-institution-name">
                  Institution name (optional)
                </Label>
                <Input
                  id="lead-institution-name"
                  value={form.institutionName}
                  onChange={(event) =>
                    handleChange("institutionName", event.target.value)
                  }
                />
                {formErrors.institutionName ? (
                  <p className="text-xs text-destructive">
                    {formErrors.institutionName}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="lead-property-count">Property count</Label>
                  <Input
                    id="lead-property-count"
                    type="number"
                    min={0}
                    value={form.propertyCount}
                    onChange={(event) =>
                      handleChange("propertyCount", event.target.value)
                    }
                  />
                  {formErrors.propertyCount ? (
                    <p className="text-xs text-destructive">
                      {formErrors.propertyCount}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lead-tenant-count">Tenant count</Label>
                  <Input
                    id="lead-tenant-count"
                    type="number"
                    min={0}
                    value={form.tenantCount}
                    onChange={(event) =>
                      handleChange("tenantCount", event.target.value)
                    }
                  />
                  {formErrors.tenantCount ? (
                    <p className="text-xs text-destructive">
                      {formErrors.tenantCount}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="lead-preferred-timeline-years">
                  Subscription duration
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label
                      htmlFor="lead-preferred-timeline-years"
                      className="text-sm"
                    >
                      Years
                    </Label>
                    <select
                      id="lead-preferred-timeline-years"
                      value={form.preferredTimelineYears}
                      onChange={(event) =>
                        handleChange("preferredTimelineYears", event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Array.from({ length: 11 }, (_, index) => (
                        <option key={index} value={String(index)}>
                          {index} year{index === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="lead-preferred-timeline-months"
                      className="text-sm"
                    >
                      Months
                    </Label>
                    <select
                      id="lead-preferred-timeline-months"
                      value={form.preferredTimelineMonths}
                      onChange={(event) =>
                        handleChange("preferredTimelineMonths", event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Array.from({ length: 12 }, (_, index) => (
                        <option key={index} value={String(index)}>
                          {index} month{index === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {formErrors.preferredTimeline ? (
                  <p className="text-xs text-destructive">
                    {formErrors.preferredTimeline}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {submitted ? (
            <Button type="button" onClick={handleClose} className="w-full">
              Close
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Sending..." : "Send request"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-full"
              >
                Cancel
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
