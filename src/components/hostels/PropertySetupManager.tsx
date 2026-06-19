"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Check,
  Lock,
  ArrowLeftRight,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { BuildingBlueprint } from "./setup/BuildingBlueprint";
import { FloorRoomGenerator } from "./setup/FloorRoomGenerator";
import { ActivatePropertyButton } from "./ActivatePropertyButton";
import { PropertyCardInvite } from "./PropertyCardInvite";
import { autoFloorName, autoPrefix } from "./setup/helpers";
import type { Floor, Room } from "./setup/types";

type Props = {
  hostelId: string;
  propertyName: string;
  isPhoneVerified: boolean;
  isActive: boolean;
  tenantJoinToken?: string | null;
  propertyCode?: string | null;
  initialFloors: Floor[];
  initialRooms: Room[];
};

type Step = "building-shell" | "add-rooms" | "blueprint" | "finalize";

export function PropertySetupManager({
  hostelId,
  propertyName,
  isPhoneVerified,
  isActive,
  tenantJoinToken,
  propertyCode,
  initialFloors,
  initialRooms,
}: Props) {
  const [floors, setFloors] = useState<Floor[]>(initialFloors);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [syncing, setSyncing] = useState(false);
  const [isPropertyActive, setIsPropertyActive] = useState(isActive);

  const [step, setStep] = useState<Step>(() => {
    if (isPropertyActive) return "finalize";
    if (initialFloors.length > 0 && initialRooms.length > 0) return "finalize";
    if (initialFloors.length > 0) return "add-rooms";
    return "building-shell";
  });

  const [shellFloorCount, setShellFloorCount] = useState(() =>
    Math.max(initialFloors.length, 1),
  );
  const [shellNames, setShellNames] = useState<string[]>(() => {
    const count = Math.max(initialFloors.length, 1);
    return Array.from(
      { length: count },
      (_, i) => initialFloors[i]?.name ?? autoFloorName(i),
    );
  });
  const [hasBasement, setHasBasement] = useState(false);
  const [basementName, setBasementName] = useState("Basement");
  const [creatingShell, setCreatingShell] = useState(false);

  const [activeFloorId, setActiveFloorId] = useState<string | null>(
    () => initialFloors[0]?.id ?? null,
  );

  const [blueprintDirty, setBlueprintDirty] = useState(false);
  const [floorToDelete, setFloorToDelete] = useState<{
    id: string;
    name: string;
    willDeactivate: boolean;
  } | null>(null);
  const [deletingFloorId, setDeletingFloorId] = useState<string | null>(null);

  function getUniqueAutoFloorName(index: number, usedNames: string[]) {
    const baseName = autoFloorName(index);
    const normalized = new Set(usedNames.map((name) => name.trim().toLowerCase()));

    if (!normalized.has(baseName.trim().toLowerCase())) {
      return baseName;
    }

    let suffix = 2;
    let candidate = `${baseName} ${suffix}`;
    while (normalized.has(candidate.trim().toLowerCase())) {
      suffix += 1;
      candidate = `${baseName} ${suffix}`;
    }

    return candidate;
  }

  function updateShellCount(newCount: number) {
    const clamped = Math.max(1, Math.min(20, newCount));
    setShellFloorCount(clamped);
    setShellNames((prev) => {
      const next = [...prev];
      const usedNames = [
        ...floors.map((floor) => floor.name),
        ...next.map((name) => name),
      ];

      while (next.length < clamped) {
        const nextName = getUniqueAutoFloorName(next.length, usedNames);
        next.push(nextName);
        usedNames.push(nextName);
      }

      return next.slice(0, clamped);
    });
  }

  function removeShellFloor(idx: number) {
    setShellNames((prev) => prev.filter((_, i) => i !== idx));
    setShellFloorCount((c) => Math.max(1, c - 1));
  }

  async function deleteFloor(floorId: string, floorName: string) {
    const willDeactivate = floors.length === 1;
    setFloorToDelete({ id: floorId, name: floorName, willDeactivate });
  }

  async function confirmDeleteFloor() {
    if (!floorToDelete) return;

    setDeletingFloorId(floorToDelete.id);
    try {
      const res = await fetch(`/api/hostels/${hostelId}/floors/${floorToDelete.id}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(payload.error ?? "Failed to delete floor.");
        return;
      }

      const remainingFloors = floors.filter((floor) => floor.id !== floorToDelete.id);
      const deactivated = Boolean(payload.deactivated);

      toast.success(
        deactivated
          ? `Deleted ${floorToDelete.name} and deactivated the property because no floors remain.`
          : `Deleted ${floorToDelete.name} and its rooms.`,
      );
      setFloorToDelete(null);
      setIsPropertyActive((current) => (deactivated ? false : current));
      await syncFromDatabase(true);
      if (activeFloorId === floorToDelete.id) {
        setActiveFloorId(remainingFloors[0]?.id ?? null);
      }
    } catch {
      toast.error("Network error deleting floor.");
    } finally {
      setDeletingFloorId(null);
    }
  }

  const syncFromDatabase = useCallback(
    async (silent = false) => {
      if (!silent) setSyncing(true);
      try {
        const [fr, rr] = await Promise.all([
          fetch(`/api/hostels/${hostelId}/floors`, { cache: "no-store" }),
          fetch(`/api/hostels/${hostelId}/rooms`, { cache: "no-store" }),
        ]);
        const fp = await fr.json();
        const rp = await rr.json();
        if (!fr.ok) {
          toast.error(fp.error ?? "Failed to load floors.");
          return;
        }
        if (!rr.ok) {
          toast.error(rp.error ?? "Failed to load rooms.");
          return;
        }
        setFloors((fp.floors ?? []) as Floor[]);
        setRooms((rp.rooms ?? []) as Room[]);
      } catch {
        toast.error("Could not sync setup data.");
      } finally {
        if (!silent) setSyncing(false);
      }
    },
    [hostelId],
  );

  useEffect(() => {
    syncFromDatabase().catch(() => toast.error("Could not load setup data."));
  }, [syncFromDatabase]);

  useEffect(() => {
    if (
      floors.length > 0 &&
      (!activeFloorId || !floors.find((f) => f.id === activeFloorId))
    ) {
      setActiveFloorId(floors[0].id);
    }
  }, [floors, activeFloorId]);

  useEffect(() => {
    if (step !== "building-shell") return;

    const savedNames = floors
      .map((floor) => floor.name.trim())
      .filter(Boolean);

    if (savedNames.length > 0) {
      setShellFloorCount(savedNames.length);
      setShellNames(savedNames);
      return;
    }

    const fallbackCount = Math.max(floors.length, 1);
    setShellFloorCount(fallbackCount);
    setShellNames(
      Array.from({ length: fallbackCount }, (_, index) => autoFloorName(index)),
    );
  }, [step, floors]);

  async function createBuildingShell() {
    if (creatingShell) return;

    // Collect all floor names from the shell UI (basement first, then regular)
    const allShellNames = [
      ...(hasBasement ? [basementName.trim()] : []),
      ...shellNames.map((n) => n.trim()),
    ].filter(Boolean);

    // Identify which are genuinely new (not already saved)
    const savedNames = new Set(floors.map((f) => f.name.toLowerCase()));
    const toCreate = allShellNames.filter((n) => !savedNames.has(n.toLowerCase()));

    // Detect duplicates among the new names
    const toLowerSet = new Set<string>();
    const hasDuplicates = toCreate.some((n) => {
      const key = n.toLowerCase();
      if (toLowerSet.has(key)) return true;
      toLowerSet.add(key);
      return false;
    });

    if (hasDuplicates) {
      toast.error("Please fix duplicate floor names before proceeding.");
      return;
    }

    if (toCreate.length === 0) {
      toast.info("All floors already exist — moving to next step.");
      setStep("add-rooms");
      return;
    }

    const names = toCreate;
    if (names.length === 0) {
      toast.error("Add at least one floor.");
      return;
    }
    setCreatingShell(true);
    try {
      for (const name of names) {
        const res = await fetch(`/api/hostels/${hostelId}/floors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const payload = await res.json();
        if (!res.ok && !payload.error?.toLowerCase().includes("already")) {
          toast.error(payload.error ?? "Failed to create floor.");
          return;
        }
      }
      await syncFromDatabase(true);
      const allRes = await fetch(`/api/hostels/${hostelId}/floors`, {
        cache: "no-store",
      });
      const allPay = await allRes.json();
      const newFloors: Floor[] = allPay.floors ?? [];
      if (newFloors.length > 0) setActiveFloorId(newFloors[0].id);
      toast.success(
        `${toCreate.length} floor${toCreate.length !== 1 ? "s" : ""} created.`,
      );
      setStep("add-rooms");
    } catch {
      toast.error("Network error creating floors.");
    } finally {
      setCreatingShell(false);
    }
  }

  const steps: { key: Step; label: string; num: number }[] = [
    { key: "building-shell", label: "Building", num: 1 },
    { key: "add-rooms", label: "Rooms", num: 2 },
    { key: "blueprint", label: "Blueprint", num: 3 },
    { key: "finalize", label: "Finalize", num: 4 },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  // Detect duplicate shell names among genuinely new floors
  const hasShellDuplicates = useMemo(() => {
    const savedNames = new Set(floors.map((f) => f.name.toLowerCase()));
    const newNames = [
      ...(hasBasement ? [basementName.trim()] : []),
      ...shellNames.map((n) => n.trim()),
    ].filter((n) => n && !savedNames.has(n.toLowerCase()));
    const seen = new Set<string>();
    return newNames.some((n) => {
      const key = n.toLowerCase();
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
  }, [hasBasement, basementName, shellNames, floors]);

  const floorsCount = floors.length;
  const roomsCount = rooms.length;
  const floorIdsWithRooms = useMemo(
    () => new Set(rooms.map((room) => room.floor_id)),
    [rooms],
  );
  const floorsNeedingRooms = useMemo(
    () => floors.filter((floor) => !floorIdsWithRooms.has(floor.id)),
    [floors, floorIdsWithRooms],
  );
  const nextFloorNeedingRooms = useMemo(() => {
    if (floorsNeedingRooms.length === 0) return null;
    if (!activeFloorId) return floorsNeedingRooms[0];

    const activePendingIndex = floorsNeedingRooms.findIndex(
      (floor) => floor.id === activeFloorId,
    );

    if (activePendingIndex === -1) return floorsNeedingRooms[0];
    if (floorsNeedingRooms.length === 1) return null;

    return floorsNeedingRooms[(activePendingIndex + 1) % floorsNeedingRooms.length];
  }, [floorsNeedingRooms, activeFloorId]);

  const floorsWithoutRoomsCount = useMemo(
    () =>
      floors.filter((floor) => !rooms.some((room) => room.floor_id === floor.id))
        .length,
    [floors, rooms],
  );

  const canGoToAddRooms = floorsCount > 0;
  const canGoToBlueprint = floorsCount > 0;
  const canGoToFinalize = floorsCount > 0 && roomsCount > 0;
  const isSetupReady = floorsCount > 0 && roomsCount > 0;

  const completionByStep: Record<Step, boolean> = {
    "building-shell": floorsCount > 0,
    "add-rooms": roomsCount > 0,
    blueprint: isSetupReady,
    finalize: isPropertyActive,
  };

  function goToStep(target: Step) {
    if (step === "blueprint" && target !== "blueprint" && blueprintDirty) {
      const confirmed = window.confirm(
        "You have unsaved blueprint edits. Leave this step anyway?",
      );
      if (!confirmed) return;
    }

    if (target === "building-shell") {
      setStep("building-shell");
      return;
    }

    if (target === "add-rooms") {
      if (!canGoToAddRooms) {
        toast.error("Create at least one floor before adding rooms.");
        return;
      }
      setStep("add-rooms");
      return;
    }

    if (target === "blueprint") {
      if (!canGoToBlueprint) {
        toast.error("Create at least one floor before opening the blueprint.");
        return;
      }

      if (roomsCount === 0) {
        const confirmed = window.confirm(
          "You have not added rooms yet. Continue to blueprint anyway?",
        );
        if (!confirmed) return;
      }

      setStep("blueprint");
      return;
    }

    if (!canGoToFinalize) {
      toast.error(
        "Complete at least one floor and one room before opening final review.",
      );
      return;
    }

    setStep("finalize");
  }

  const activeGuidance: {
    title: string;
    primaryAction: string;
    doneWhen: string;
    supportText: string;
  } =
    step === "building-shell"
      ? {
          title: "Define your building shell",
          primaryAction: "Set floor count, review floor names, then save floors.",
          doneWhen: "At least one floor is saved.",
          supportText:
            floorsCount > 0
              ? `${floorsCount} floor${floorsCount !== 1 ? "s" : ""} already saved.`
              : "No floors saved yet.",
        }
      : step === "add-rooms"
        ? {
            title: "Add rooms floor by floor",
            primaryAction:
              "Select a floor tab, generate room batch, save, then reset for next batch.",
            doneWhen: "At least one room is saved.",
            supportText:
              floorsWithoutRoomsCount > 0
                ? `${floorsWithoutRoomsCount} floor${floorsWithoutRoomsCount !== 1 ? "s" : ""} still need rooms.`
                : "All floors currently have at least one room.",
          }
        : step === "blueprint"
          ? {
              title: "Review and edit structure",
              primaryAction:
                "Review floor and room details, then continue to final review.",
              doneWhen:
                "Floors and rooms are configured and the structure looks correct.",
              supportText: isSetupReady
                ? "Structure is ready for final review."
                : "Rooms are still missing, so activation will stay blocked.",
            }
          : {
              title: "Review and finalize",
              primaryAction:
                "Confirm setup checklist, activate the property, and share invite details.",
              doneWhen: "Property is active and ready for tenant onboarding.",
              supportText: isPropertyActive
                ? "Property is already active."
                : "Activation is ready once checklist is complete.",
            };

  return (
    <div id="floors-section" className="w-full space-y-4 sm:space-y-6">
      {/* Step indicator */}
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-1.5 sm:gap-2">
          {steps.map((s, i) => {
            const done = completionByStep[s.key];
            const active = s.key === step;
            const reachable =
              s.key === "building-shell"
                ? true
                : s.key === "add-rooms"
                  ? canGoToAddRooms
                  : s.key === "blueprint"
                    ? canGoToBlueprint
                    : canGoToFinalize;
            return (
              <div key={s.key} className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => goToStep(s.key)}
                  className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-2 sm:text-sm ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-primary/15 text-primary hover:bg-primary/20"
                        : reachable
                          ? "text-muted-foreground hover:text-foreground"
                          : "cursor-not-allowed text-muted-foreground/50"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold sm:text-[11px] ${
                      active ? "bg-white/20" : done ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : s.num}
                  </span>
                  {s.label}
                </button>
                {i < steps.length - 1 && (
                  <ChevronRight className="ml-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 sm:ml-1 sm:h-4 sm:w-4" />
                )}
              </div>
            );
          })}
          {syncing && (
            <div className="ml-2 flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Syncing…
            </div>
          )}
        </div>
      </div>

      <Card className="w-full rounded-2xl border-border/60 bg-muted/20">
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Step {stepIndex + 1} of {steps.length}
              </p>
              {/* Completion badge */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : isSetupReady
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : roomsCount > 0
                        ? "bg-yellow-400/10 text-yellow-700 dark:text-yellow-400"
                        : floorsCount > 0
                          ? "bg-blue-400/10 text-blue-700 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                }`}
                title={
                  isPropertyActive
                    ? "Setup complete"
                    : isSetupReady
                      ? "Ready for activation"
                      : roomsCount > 0
                        ? "Rooms added"
                        : floorsCount > 0
                          ? "Floors added"
                          : "Not started"
                }
              >
                {isPropertyActive
                  ? "100% Complete"
                  : isSetupReady
                    ? "Ready to Activate"
                    : roomsCount > 0
                      ? `${Math.round((roomsCount / (floorsCount * 5 || 1)) * 100)}% Rooms Added`
                      : floorsCount > 0
                        ? `${Math.round((floorsCount / 5) * 100)}% Floors Added`
                        : "0%"}
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {activeGuidance.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {activeGuidance.primaryAction}
            </p>
            <p className="text-xs text-muted-foreground">
              Done when: {activeGuidance.doneWhen}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
            <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">
              Floors: {floorsCount}
            </span>
            <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">
              Rooms: {roomsCount}
            </span>
            <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">
              {activeGuidance.supportText}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ─── STEP 1: Building Shell ────────────────────────────────────────── */}
      {step === "building-shell" && (
        <Card className="w-full rounded-2xl border-border/70">
          <div className="p-2">
            <div className="flex items-center gap-2 text-base">
              How many floors does your property have?
            </div>
            <p className="text-sm text-muted-foreground">
              Set the number of floors and confirm their names. We auto-suggest names
              — edit any you like.
            </p>
          </div>
          <CardContent className="space-y-4 sm:space-y-6">
            {/* Floor count stepper */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-xl sm:h-10 sm:w-10"
                onClick={() => updateShellCount(shellFloorCount - 1)}
                disabled={shellFloorCount <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-[2ch] text-center text-xl font-bold tabular-nums sm:text-2xl">
                {shellFloorCount}
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-xl sm:h-10 sm:w-10"
                onClick={() => updateShellCount(shellFloorCount + 1)}
                disabled={shellFloorCount >= 20}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground sm:text-sm">
                floor{shellFloorCount !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Basement toggle */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setHasBasement((v) => !v)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  hasBasement
                    ? "border-zinc-400/60 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
                    : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <ArrowLeftRight className="h-4 w-4 opacity-60" />
                {hasBasement ? "Basement included" : "Include Basement"}
              </button>
              <span className="text-xs text-muted-foreground/60">
                Adds a basement floor at the bottom of your building.
              </span>
            </div>

            {/* Building visual — floors stacked, ground at bottom */}
            <div className="flex flex-col-reverse gap-0 overflow-hidden rounded-2xl border border-border/60">
              {/* Basement entry (always at visual bottom = first in col-reverse) */}
              {hasBasement &&
                (() => {
                  const bSaved = floors.some(
                    (f) =>
                      f.name.toLowerCase() === basementName.trim().toLowerCase(),
                  );
                  return (
                    <div
                      className={`flex items-center gap-3 border-b border-border/40 px-4 py-2.5 ${
                        bSaved ? "bg-muted/50 opacity-70" : "bg-zinc-500/5"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-500/20 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {bSaved ? <Check className="h-3.5 w-3.5" /> : "B"}
                      </span>
                      {bSaved ? (
                        <span className="flex h-8 flex-1 items-center text-sm font-medium opacity-70">
                          {basementName}
                        </span>
                      ) : (
                        <Input
                          value={basementName}
                          onChange={(e) => setBasementName(e.target.value)}
                          className="h-8 flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                          placeholder="Basement"
                        />
                      )}
                      {bSaved ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ saved
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-[10px] font-mono text-muted-foreground">
                          B01…
                        </span>
                      )}
                    </div>
                  );
                })()}

              {shellNames.map((name, idx) => {
                const savedFloor = floors.find(
                  (f) => f.name.toLowerCase() === name.trim().toLowerCase(),
                );
                const alreadySaved = !!savedFloor;

                // Duplicate among new entries (not saved ones)
                const savedNames = new Set(floors.map((f) => f.name.toLowerCase()));
                const isDuplicate =
                  !alreadySaved &&
                  [
                    ...(hasBasement ? [basementName.trim()] : []),
                    ...shellNames.map((n) => n.trim()),
                  ]
                    .filter((n) => n && !savedNames.has(n.toLowerCase()))
                    .filter((n) => n.toLowerCase() === name.trim().toLowerCase())
                    .length > 1;

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-b-0 transition-colors ${
                      alreadySaved
                        ? "bg-muted/50 opacity-70"
                        : isDuplicate
                          ? "bg-destructive/5"
                          : idx === 0
                            ? "bg-primary/5"
                            : "bg-muted/20"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        alreadySaved
                          ? "bg-muted text-muted-foreground"
                          : idx === 0
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {alreadySaved ? (
                        <Lock className="h-3 w-3" />
                      ) : idx === 0 ? (
                        "G"
                      ) : (
                        idx
                      )}
                    </span>

                    {alreadySaved ? (
                      <span className="flex h-8 flex-1 items-center text-sm font-medium opacity-70">
                        {name}
                      </span>
                    ) : (
                      <Input
                        value={name}
                        onChange={(e) => {
                          const next = [...shellNames];
                          next[idx] = e.target.value;
                          setShellNames(next);
                        }}
                        className={`h-8 flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0 ${
                          isDuplicate ? "text-destructive" : ""
                        }`}
                        placeholder={autoFloorName(idx)}
                      />
                    )}

                    {alreadySaved && (
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ saved
                      </span>
                    )}
                    {isDuplicate && (
                      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        duplicate
                      </span>
                    )}
                    {!alreadySaved && !isDuplicate && (
                      <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-[10px] font-mono text-muted-foreground">
                        {autoPrefix(name, idx)}01…
                      </span>
                    )}
                    {(alreadySaved || shellNames.length > 1) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (alreadySaved && savedFloor) {
                            void deleteFloor(savedFloor.id, savedFloor.name);
                          } else {
                            removeShellFloor(idx);
                          }
                        }}
                        className="ml-1 shrink-0 rounded-lg p-1 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={alreadySaved ? "Delete floor" : "Remove floor"}
                      >
                        {alreadySaved ? (
                          <Trash2 className="h-3.5 w-3.5" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {floors.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ You already have {floors.length} saved floor
                {floors.length !== 1 ? "s" : ""} (shown locked above). New names will
                be added.
              </p>
            )}


            {hasShellDuplicates && (
              <p className="text-xs text-destructive">
                ✕ Please fix duplicate floor names before proceeding.
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                className="w-full rounded-xl gap-2 sm:w-auto"
                onClick={createBuildingShell}
                disabled={creatingShell || hasShellDuplicates}
              >
                {creatingShell ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {creatingShell ? "Saving floors…" : "Save Floors and Continue"}
              </Button>
              {floors.length > 0 && (
                <Button
                  variant="ghost"
                  className="w-full rounded-xl sm:w-auto"
                  onClick={() => goToStep("add-rooms")}
                >
                  Continue With Existing Floors
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 2: Add Rooms ────────────────────────────────────────────── */}
      {step === "add-rooms" && (
        <Card className="w-full rounded-2xl border-border/70" id="rooms-section">
          <CardContent>
            {floors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No floors yet. Go back to Step 1.
                </p>
                <Button
                  variant="outline"
                  className="mt-3 rounded-xl"
                  onClick={() => goToStep("building-shell")}
                >
                  ← Back to Building Shell
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">
                    Floor coverage: {floorsCount - floorsWithoutRoomsCount}/
                    {floorsCount} floor
                    {floorsCount !== 1 ? "s" : ""} have rooms.
                  </span>
                  {nextFloorNeedingRooms ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-full rounded-lg text-[11px] sm:w-auto sm:self-auto"
                      onClick={() => setActiveFloorId(nextFloorNeedingRooms.id)}
                    >
                      Next floor needing rooms: {nextFloorNeedingRooms.name}
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                      All floors have rooms
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {floors.map((floor) => {
                      const floorRooms = rooms.filter((r) => r.floor_id === floor.id);
                      const totalBeds = floorRooms.reduce(
                        (sum, r) => sum + r.capacity,
                        0,
                      );
                      const active = activeFloorId === floor.id;
                      return (
                        <button
                          key={floor.id}
                          type="button"
                          onClick={() => setActiveFloorId(floor.id)}
                          className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          {floor.name}
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              floorRooms.length > 0
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {floorRooms.length} room
                            {floorRooms.length !== 1 ? "s" : ""}
                            {totalBeds > 0 &&
                              ` · ${totalBeds} bed${totalBeds !== 1 ? "s" : ""}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                </div>

                {activeFloorId && floors.find((f) => f.id === activeFloorId) ? (
                  <FloorRoomGenerator
                    key={activeFloorId}
                    hostelId={hostelId}
                    floor={floors.find((f) => f.id === activeFloorId)!}
                    onSaved={() => syncFromDatabase(true)}
                    floorRooms={rooms.filter((r) => r.floor_id === activeFloorId)}
                    existingRoomNumbers={rooms
                      .filter((r) => r.floor_id !== activeFloorId)
                      .map((r) => r.room_number)}
                  />
                ) : null}

                <div className="flex justify-stretch pt-4 sm:justify-start">
                  <Button
                    type="button"
                    className="w-full rounded-xl gap-1.5 sm:w-auto"
                    onClick={() => goToStep("blueprint")}
                    disabled={floors.length === 0}
                  >
                    Continue to Blueprint
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 3: Blueprint ───────────────────────────────────────────── */}
      {step === "blueprint" && (
        <div className="space-y-4">
          {roomsCount === 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              No rooms are saved yet. Review floors here, then go back to Add Rooms
              to finish setup.
            </div>
          )}
          <div>
            <h3 className="font-semibold">Property Blueprint</h3>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="w-full rounded-xl gap-1.5 sm:w-auto"
                onClick={() => goToStep("add-rooms")}
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Add Rooms
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl gap-1.5 sm:w-auto"
                onClick={() => {
                  goToStep("add-rooms");
                  setAddingFloor(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add Floor
              </Button>
              <Button
                className="w-full rounded-xl gap-1.5 sm:w-auto"
                onClick={() => goToStep("finalize")}
                disabled={!canGoToFinalize}
              >
                Final Review
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <BuildingBlueprint
            hostelId={hostelId}
            floors={floors}
            rooms={rooms}
            onSync={() => syncFromDatabase(true)}
            onDirtyChange={setBlueprintDirty}
          />
        </div>
      )}

      {/* ─── STEP 4: Final Review ─────────────────────────────────────────── */}
      {step === "finalize" && (
        <Card className="w-full rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Final Review and Activation</CardTitle>
            <p className="text-sm text-muted-foreground">
              Confirm checklist items below, then activate your property to start
              onboarding tenants.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Setup Checklist
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-foreground">
                    At least one floor is saved
                  </span>
                  {floorsCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                      Complete
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg text-xs"
                      onClick={() => goToStep("building-shell")}
                    >
                      Fix
                    </Button>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-foreground">At least one room is saved</span>
                  {roomsCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                      Complete
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg text-xs"
                      onClick={() => goToStep("add-rooms")}
                    >
                      Add Rooms
                    </Button>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-foreground">
                    All floors have rooms (recommended)
                  </span>
                  {floorsWithoutRoomsCount === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                      Complete
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg text-xs"
                      onClick={() => goToStep("add-rooms")}
                    >
                      {floorsWithoutRoomsCount} pending
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background p-3">
              <p className="text-sm font-semibold text-foreground">Activation</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Property: {propertyName} • Floors: {floorsCount} • Rooms:{" "}
                {roomsCount}
              </p>

              {isPropertyActive ? (
                <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  This property is active and ready for tenant onboarding.
                </div>
              ) : canGoToFinalize ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <ActivatePropertyButton
                    hostelId={hostelId}
                    disabled={!isPhoneVerified}
                    disabledReason="Phone number not verified. Verify from My Profile to activate property."
                  />
                  {!isPhoneVerified ? (
                    <span className="text-xs text-amber-700 dark:text-amber-300">
                      Verify phone number in My Profile before activation.
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Activation will generate tenant join token and property code.
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Finish the checklist above before activation.
                </div>
              )}
            </div>

            {isPropertyActive && tenantJoinToken ? (
              <PropertyCardInvite
                joinToken={tenantJoinToken}
                propertyName={propertyName}
                propertyCode={propertyCode ?? undefined}
              />
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl sm:w-auto"
                onClick={() => goToStep("blueprint")}
              >
                Back to Blueprint
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(floorToDelete)}
        onOpenChange={(open) => {
          if (!open) setFloorToDelete(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-border/70 bg-card p-5 shadow-xl">
          <DialogHeader>
            <DialogTitle>Delete floor?</DialogTitle>
            <DialogDescription>
              This will remove {floorToDelete?.name ?? "this floor"} and all rooms
              under it.
              {floorToDelete?.willDeactivate
                ? " Since no floors would remain, the property will be deactivated."
                : " This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFloorToDelete(null)}
              disabled={Boolean(deletingFloorId)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteFloor()}
              disabled={Boolean(deletingFloorId)}
            >
              {deletingFloorId ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete floor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
