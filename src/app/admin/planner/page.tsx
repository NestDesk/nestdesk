"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Trash2,
  Sparkles,
  Mail,
  ToggleLeft,
  ToggleRight,
  MoreVertical,
  Pencil,
  Search,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../../components/ui/dropdown-menu";
import { calculateCustomPlanPrice } from "../../../lib/custom-institution-plans";

type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  monthly_price_paise: number;
  yearly_price_paise: number;
  max_properties: number;
  max_tenants: number;
  base_fee_inr: number;
  property_fee_inr: number;
  tenant_fee_inr: number;
  tenant_threshold: number;
  pricing_property_count: number | null;
  pricing_tenant_count: number | null;
  formula_version: string;
  is_active: boolean;
  account_count: number;
  created_at: string;
};

const DEFAULT_FORMULA = {
  baseFeeInr: 100,
  propertyFeeInr: 900,
  tenantFeeInr: 7,
  tenantThreshold: 200,
};

export default function AdminPlannerPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignPlan, setAssignPlan] = useState<PlanRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePlan, setDeletePlan] = useState<PlanRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<
    Array<{ id: string; email: string | null }>
  >([]);
  const [selectedOwner, setSelectedOwner] = useState<{
    id: string;
    email: string | null;
  } | null>(null);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseFeeInr, setBaseFeeInr] = useState(String(DEFAULT_FORMULA.baseFeeInr));
  const [propertyFeeInr, setPropertyFeeInr] = useState(
    String(DEFAULT_FORMULA.propertyFeeInr),
  );
  const [tenantFeeInr, setTenantFeeInr] = useState(
    String(DEFAULT_FORMULA.tenantFeeInr),
  );
  const [tenantThreshold, setTenantThreshold] = useState(
    String(DEFAULT_FORMULA.tenantThreshold),
  );
  const [pricingPropertyCount, setPricingPropertyCount] = useState("4");
  const [pricingTenantCount, setPricingTenantCount] = useState("200");
  const [monthly, setMonthly] = useState(0);
  const [yearly, setYearly] = useState(0);
  const [maxProperties, setMaxProperties] = useState(4);
  const [maxTenants, setMaxTenants] = useState(1);
  const [formulaVersion, setFormulaVersion] = useState("v1");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/planner/plans");
      if (!res.ok) throw new Error("Failed to load plans.");
      const data = (await res.json()) as { plans: PlanRow[] };
      setPlans(data.plans ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load plans.");
    } finally {
      setLoading(false);
    }
  };

  const fetchOwners = async (search = "") => {
    setOwnersLoading(true);
    try {
      const res = await fetch(
        `/api/admin/owners?search=${encodeURIComponent(search)}&limit=50&offset=0`,
      );
      const data = (await res.json()) as {
        owners?: Array<{ id: string; email: string | null }>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Failed to load owner accounts.");
      }
      setOwnerOptions(data.owners ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load owner accounts.",
      );
      setOwnerOptions([]);
    } finally {
      setOwnersLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (!assignDialogOpen || !ownerDropdownOpen) return;
    fetchOwners(ownerQuery);
  }, [assignDialogOpen, ownerDropdownOpen, ownerQuery]);

  const parseNumericInput = (value: string, fallback = 0) => {
    const sanitized = value.trim().replace(/^0+(?=\d)/, "");
    const parsed = Number(sanitized === "" ? "0" : sanitized);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const normalizeNumericInput = (value: string) =>
    value.trim().replace(/^0+(?=\d)/, "");

  const pricingPropertyCountValue = parseNumericInput(pricingPropertyCount, 0);
  const pricingTenantCountValue = parseNumericInput(pricingTenantCount, 0);
  const tenantThresholdValue = parseNumericInput(tenantThreshold, 0);
  const baseFeeInrValue = parseNumericInput(baseFeeInr, 0);
  const propertyFeeInrValue = parseNumericInput(propertyFeeInr, 0);
  const tenantFeeInrValue = parseNumericInput(tenantFeeInr, 0);

  const openCreateDialog = (useCalculator = false) => {
    setSelectedPlanId(null);
    setName("");
    setDescription("");
    setBaseFeeInr(useCalculator ? baseFeeInr : String(DEFAULT_FORMULA.baseFeeInr));
    setPropertyFeeInr(
      useCalculator ? propertyFeeInr : String(DEFAULT_FORMULA.propertyFeeInr),
    );
    setTenantFeeInr(
      useCalculator ? tenantFeeInr : String(DEFAULT_FORMULA.tenantFeeInr),
    );
    setTenantThreshold(
      useCalculator ? tenantThreshold : String(DEFAULT_FORMULA.tenantThreshold),
    );
    setPricingPropertyCount(useCalculator ? pricingPropertyCount : "1");
    setPricingTenantCount(useCalculator ? pricingTenantCount : "150");
    setMonthly(useCalculator ? calculatedPrice.monthlyPricePaise / 100 : 0);
    setYearly(useCalculator ? calculatedPrice.yearlyPricePaise / 100 : 0);
    setMaxProperties(useCalculator ? Math.max(1, pricingPropertyCountValue) : 1);
    setMaxTenants(useCalculator ? Math.max(1, pricingTenantCountValue) : 1);
    setFormulaVersion("v1");
    setIsActive(true);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (planId: string) => {
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;

    setSelectedPlanId(plan.id);
    setName(plan.name);
    setDescription(plan.description ?? "");
    setBaseFeeInr(String(plan.base_fee_inr ?? DEFAULT_FORMULA.baseFeeInr));
    setPropertyFeeInr(
      String(plan.property_fee_inr ?? DEFAULT_FORMULA.propertyFeeInr),
    );
    setTenantFeeInr(String(plan.tenant_fee_inr ?? DEFAULT_FORMULA.tenantFeeInr));
    setTenantThreshold(
      String(plan.tenant_threshold ?? DEFAULT_FORMULA.tenantThreshold),
    );
    setPricingPropertyCount(
      String(plan.pricing_property_count ?? plan.max_properties),
    );
    setPricingTenantCount(String(plan.pricing_tenant_count ?? plan.max_tenants));
    setMonthly(plan.monthly_price_paise / 100);
    setYearly(plan.yearly_price_paise / 100);
    setMaxProperties(plan.max_properties);
    setMaxTenants(plan.max_tenants);
    setFormulaVersion(plan.formula_version || "v1");
    setIsActive(plan.is_active);
    setError(null);
    setDialogOpen(true);
  };

  const calculatedPrice = useMemo(
    () =>
      calculateCustomPlanPrice({
        propertyCount: pricingPropertyCountValue,
        tenantCount: pricingTenantCountValue,
        baseFeeInr: baseFeeInrValue,
        propertyFeeInr: propertyFeeInrValue,
        tenantFeeInr: tenantFeeInrValue,
        tenantThreshold: tenantThresholdValue,
      }),
    [
      pricingPropertyCountValue,
      pricingTenantCountValue,
      baseFeeInrValue,
      propertyFeeInrValue,
      tenantFeeInrValue,
      tenantThresholdValue,
    ],
  );

  const resetFormula = () => {
    setBaseFeeInr(String(DEFAULT_FORMULA.baseFeeInr));
    setPropertyFeeInr(String(DEFAULT_FORMULA.propertyFeeInr));
    setTenantFeeInr(String(DEFAULT_FORMULA.tenantFeeInr));
    setTenantThreshold(String(DEFAULT_FORMULA.tenantThreshold));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Plan name is required.");
      return;
    }
    if (monthly < 0 || yearly < 0) {
      setError("Monthly and yearly prices must be zero or greater.");
      return;
    }
    if (maxProperties < 1 || maxTenants < 1) {
      setError("Max properties and max tenants must be at least 1.");
      return;
    }

    setSubmitting(true);
    try {
      const url = selectedPlanId
        ? `/api/admin/planner/plans?planId=${selectedPlanId}`
        : "/api/admin/planner/plans";
      const method = selectedPlanId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          monthlyPricePaise: Math.round(monthly * 100),
          yearlyPricePaise: Math.round(yearly * 100),
          maxProperties,
          maxTenants,
          baseFeeInr: baseFeeInrValue,
          propertyFeeInr: propertyFeeInrValue,
          tenantFeeInr: tenantFeeInrValue,
          tenantThreshold: tenantThresholdValue,
          pricingPropertyCount: pricingPropertyCountValue,
          pricingTenantCount: pricingTenantCountValue,
          formulaVersion,
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save plan.");
      toast.success(
        `Custom institution plan ${selectedPlanId ? "updated" : "created"}.`,
      );
      setDialogOpen(false);
      fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (plan: PlanRow) => {
    setDeletePlan(plan);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletePlan) return;
    if (deletePlan.is_active && deletePlan.account_count > 0) {
      toast.error(
        "Cannot delete an active custom plan that is assigned to owner accounts.",
      );
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/planner/plans?planId=${deletePlan.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete plan.");
      toast.success("Custom institution plan deleted.");
      fetchPlans();
      setDeleteDialogOpen(false);
      setDeletePlan(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete plan.");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (plan: PlanRow) => {
    try {
      const res = await fetch(`/api/admin/planner/plans?planId=${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: plan.name,
          description: plan.description,
          monthlyPricePaise: plan.monthly_price_paise,
          yearlyPricePaise: plan.yearly_price_paise,
          maxProperties: plan.max_properties,
          maxTenants: plan.max_tenants,
          baseFeeInr: plan.base_fee_inr,
          propertyFeeInr: plan.property_fee_inr,
          tenantFeeInr: plan.tenant_fee_inr,
          tenantThreshold: plan.tenant_threshold,
          pricingPropertyCount: plan.pricing_property_count,
          pricingTenantCount: plan.pricing_tenant_count,
          formulaVersion: plan.formula_version,
          isActive: !plan.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update plan status.");
      toast.success(
        `Plan ${!plan.is_active ? "activated" : "deactivated"} successfully.`,
      );
      fetchPlans();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const handleAssignByEmail = async () => {
    if (!assignPlan) return;
    const normalizedEmail = ownerEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Owner email is required.");
      return;
    }

    setAssigning(true);
    try {
      let ownerId = selectedOwner?.id;

      if (!ownerId) {
        const ownersRes = await fetch(
          `/api/admin/owners?search=${encodeURIComponent(normalizedEmail)}&limit=50&offset=0`,
        );
        const ownersData = (await ownersRes.json()) as {
          owners?: Array<{ id: string; email: string | null }>;
          error?: string;
        };

        if (!ownersRes.ok) {
          throw new Error(ownersData.error || "Failed to search owner by email.");
        }

        const matchedOwner = (ownersData.owners ?? []).find(
          (owner) => owner.email?.toLowerCase() === normalizedEmail,
        );

        if (!matchedOwner) {
          throw new Error("No owner account found with this email address.");
        }

        ownerId = matchedOwner.id;
      }

      const assignRes = await fetch(`/api/admin/owners/${ownerId}/assign-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPlanId: assignPlan.id }),
      });

      const assignData = (await assignRes.json()) as { error?: string };
      if (!assignRes.ok) {
        throw new Error(assignData.error || "Failed to assign custom plan.");
      }

      toast.success("Custom plan assigned successfully.");
      setAssignDialogOpen(false);
      setAssignPlan(null);
      setOwnerEmail("");
      setOwnerQuery("");
      setSelectedOwner(null);
    } finally {
      setAssigning(false);
    }
  };

  const planSummary = useMemo(() => {
    const needle = planSearch.trim().toLowerCase();
    return plans
      .filter((plan) => {
        if (!needle) return true;
        const fullText = `${plan.name} ${plan.description ?? ""}`.toLowerCase();
        return fullText.includes(needle);
      })
      .map((plan) => ({
        ...plan,
        monthly: `₹${(plan.monthly_price_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        yearly: `₹${(plan.yearly_price_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      }));
  }, [plans, planSearch]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Custom plans
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            Curate institution pricing
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Calculate premium plan pricing, curate custom offers, and assign them to
            owner accounts with one streamlined workflow.
          </p>
        </div>
      </div>

      <Card className="rounded-3xl border border-border/70 bg-background/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Pricing calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion type="single" collapsible defaultValue="pricing-calculator">
            <AccordionItem
              value="pricing-calculator"
              className="overflow-hidden rounded-3xl border border-border/60 bg-muted/40"
            >
              <AccordionTrigger className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground">
                <span>Pricing calculator</span>
                <span className="text-xs text-muted-foreground">
                  Expand to edit inputs
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                <div className="grid gap-6 lg:grid-cols-[minmax(280px,420px)_1fr]">
                  <div className="space-y-4 rounded-3xl border border-border/70 bg-background/90 p-4">
                    <div>
                      <Label htmlFor="calc-property-count">Property count</Label>
                      <Input
                        id="calc-property-count"
                        type="number"
                        min={0}
                        value={pricingPropertyCount}
                        onChange={(event) =>
                          setPricingPropertyCount(
                            normalizeNumericInput(event.target.value),
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="calc-tenant-count">Tenant count</Label>
                      <Input
                        id="calc-tenant-count"
                        type="number"
                        min={0}
                        value={pricingTenantCount}
                        onChange={(event) =>
                          setPricingTenantCount(
                            normalizeNumericInput(event.target.value),
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="calc-threshold">Tenant threshold</Label>
                      <Input
                        id="calc-threshold"
                        type="number"
                        min={0}
                        value={tenantThreshold}
                        onChange={(event) =>
                          setTenantThreshold(
                            normalizeNumericInput(event.target.value),
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="calc-base-fee">Base fee (INR)</Label>
                      <Input
                        id="calc-base-fee"
                        type="number"
                        min={0}
                        value={baseFeeInr}
                        onChange={(event) =>
                          setBaseFeeInr(normalizeNumericInput(event.target.value))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="calc-property-fee">
                        Per property fee (INR)
                      </Label>
                      <Input
                        id="calc-property-fee"
                        type="number"
                        min={0}
                        value={propertyFeeInr}
                        onChange={(event) =>
                          setPropertyFeeInr(
                            normalizeNumericInput(event.target.value),
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="calc-tenant-fee">
                        Tenant overage fee (INR)
                      </Label>
                      <Input
                        id="calc-tenant-fee"
                        type="number"
                        min={0}
                        value={tenantFeeInr}
                        onChange={(event) =>
                          setTenantFeeInr(normalizeNumericInput(event.target.value))
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border/70 bg-background/90 p-4">
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                          Formula preview
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          price = ₹{baseFeeInrValue} + ₹{propertyFeeInrValue} x{" "}
                          {pricingPropertyCountValue} + ₹{tenantFeeInrValue} x max(0,{" "}
                          {pricingTenantCountValue} - {tenantThresholdValue})
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="rounded-2xl bg-muted/80 p-4">
                        <p className="text-sm font-semibold text-foreground">
                          Monthly
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">
                          ₹
                          {(calculatedPrice.monthlyPricePaise / 100).toLocaleString(
                            "en-IN",
                          )}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-muted/80 p-4">
                        <p className="text-sm font-semibold text-foreground">
                          Yearly
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">
                          ₹
                          {(calculatedPrice.yearlyPricePaise / 100).toLocaleString(
                            "en-IN",
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <Button type="button" onClick={() => openCreateDialog(true)}>
                        Create plan
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={resetFormula}
                      >
                        Reset parameters
                      </Button>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/70 bg-background/80 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Curated custom plans</CardTitle>
            <Input
              value={planSearch}
              onChange={(event) => setPlanSearch(event.target.value)}
              placeholder="Search curated plans..."
              className="w-full sm:w-72"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : planSummary.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground">
              No custom institution plans created yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Pricing
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Accounts
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Limits
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Formula
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {planSummary.map((plan) => (
                    <tr key={plan.id}>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-foreground">{plan.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {plan.description ?? "No description."}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium text-foreground">
                          {plan.monthly} / {plan.yearly}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Monthly / yearly
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-foreground">
                          {plan.account_count}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          owner account{plan.account_count !== 1 ? "s" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-foreground">
                          {plan.max_properties} properties
                        </p>
                        <p className="mt-1 text-foreground">
                          {plan.max_tenants} tenants
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-foreground">{plan.formula_version}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          base ₹{plan.base_fee_inr}, property ₹
                          {plan.property_fee_inr}, tenant ₹{plan.tenant_fee_inr}{" "}
                          above {plan.tenant_threshold}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${plan.is_active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"}`}
                        >
                          {plan.is_active ? "Active" : "Expired"}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onSelect={() => {
                                setAssignPlan(plan);
                                setOwnerEmail("");
                                setAssignDialogOpen(true);
                              }}
                            >
                              <Mail className="mr-2 h-4 w-4" /> Assign to
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleToggleStatus(plan)}
                            >
                              {plan.is_active ? (
                                <>
                                  <ToggleRight className="mr-2 h-4 w-4" /> Deactivate
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="mr-2 h-4 w-4" /> Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => openEditDialog(plan.id)}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => openDeleteDialog(plan)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlanId
                ? "Edit custom institution plan"
                : "Create custom institution plan"}
            </DialogTitle>
            <DialogDescription>
              Add unique plan details, capacity limits, and prices. These plans will
              replace the default institution plan for assigned owners.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="plan-name">Plan name</Label>
              <Input
                id="plan-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Institution Plus"
              />
            </div>
            <div>
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Custom rollout plan for large institutions..."
                rows={4}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="max-properties">Max properties</Label>
                <Input
                  id="max-properties"
                  type="number"
                  min={1}
                  value={maxProperties}
                  onChange={(event) =>
                    setMaxProperties(
                      Math.max(1, parseNumericInput(event.target.value, 1)),
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor="max-tenants">Max tenants</Label>
                <Input
                  id="max-tenants"
                  type="number"
                  min={1}
                  value={maxTenants}
                  onChange={(event) =>
                    setMaxTenants(
                      Math.max(1, parseNumericInput(event.target.value, 1)),
                    )
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label htmlFor="base-fee">Base fee (INR)</Label>
                <Input
                  id="base-fee"
                  type="number"
                  min={0}
                  value={baseFeeInr}
                  onChange={(event) =>
                    setBaseFeeInr(normalizeNumericInput(event.target.value))
                  }
                />
              </div>
              <div>
                <Label htmlFor="property-fee">Property fee (INR)</Label>
                <Input
                  id="property-fee"
                  type="number"
                  min={0}
                  value={propertyFeeInr}
                  onChange={(event) =>
                    setPropertyFeeInr(normalizeNumericInput(event.target.value))
                  }
                />
              </div>
              <div>
                <Label htmlFor="tenant-fee">Tenant fee (INR)</Label>
                <Input
                  id="tenant-fee"
                  type="number"
                  min={0}
                  value={tenantFeeInr}
                  onChange={(event) =>
                    setTenantFeeInr(normalizeNumericInput(event.target.value))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="monthly-price">Monthly price (INR)</Label>
                <Input
                  id="monthly-price"
                  type="number"
                  min={0}
                  value={monthly}
                  onChange={(event) =>
                    setMonthly(parseNumericInput(event.target.value, 0))
                  }
                />
              </div>
              <div>
                <Label htmlFor="yearly-price">Yearly price (INR)</Label>
                <Input
                  id="yearly-price"
                  type="number"
                  min={0}
                  value={yearly}
                  onChange={(event) =>
                    setYearly(parseNumericInput(event.target.value, 0))
                  }
                />
              </div>
            </div>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete custom plan</DialogTitle>
            <DialogDescription>
              {deletePlan?.is_active && deletePlan?.account_count > 0
                ? "This active plan is assigned to owner accounts and cannot be deleted. Deactivate it and remove assignments first."
                : "Delete this custom institution plan. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {deletePlan?.name ?? "Selected plan"}
              </p>
              {deletePlan?.is_active && deletePlan?.account_count > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {deletePlan.account_count} owner account
                  {deletePlan.account_count !== 1 ? "s" : ""} currently assigned.
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletePlan(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={
                deleting ||
                (!!deletePlan?.is_active && deletePlan?.account_count > 0)
              }
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign custom plan to owner</DialogTitle>
            <DialogDescription>
              Assign this curated plan to an owner account using the searchable owner
              picker.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="assign-plan-name">Plan</Label>
              <Input id="assign-plan-name" value={assignPlan?.name ?? ""} readOnly />
            </div>
            <div className="relative">
              <Label htmlFor="assign-owner-email">Owner account</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="assign-owner-email"
                  type="text"
                  placeholder="Search owner by email"
                  value={ownerQuery}
                  onFocus={() => setOwnerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setOwnerDropdownOpen(false), 150)}
                  onChange={(event) => {
                    setOwnerQuery(event.target.value);
                    setOwnerEmail(event.target.value);
                    setSelectedOwner(null);
                  }}
                  autoComplete="off"
                  className="pl-10"
                />
              </div>
              {assignDialogOpen && ownerDropdownOpen ? (
                <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-b-2xl border border-border/80 bg-background shadow-lg">
                  {ownersLoading ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Loading owners...
                    </div>
                  ) : ownerOptions.length > 0 ? (
                    ownerOptions.map((owner) => (
                      <button
                        key={owner.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        className={`w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/80 ${selectedOwner?.id === owner.id ? "bg-muted/80" : ""}`}
                        onClick={() => {
                          setSelectedOwner(owner);
                          setOwnerEmail(owner.email ?? "");
                          setOwnerQuery(owner.email ?? "");
                          setOwnerOptions([owner]);
                          setOwnerDropdownOpen(false);
                        }}
                      >
                        {owner.email ?? "Unnamed owner"}
                      </button>
                    ))
                  ) : ownerQuery.trim() !== "" ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      No owners found.
                    </div>
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground">
                      Search owners by email to assign a plan.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assigning}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAssignByEmail}
              disabled={assigning || !selectedOwner?.id}
            >
              {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
