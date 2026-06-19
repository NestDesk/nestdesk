"use client";

import { useState, useMemo } from "react";
import { Loader2, Zap, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { DraftRoomCard } from "./RoomCard";
import {
  OCCUPANCY_PRESETS,
  occupancyColor,
  occupancyLabel,
  bedIcons,
} from "./helpers";
import type { Floor, Room, DraftRoom } from "./types";

type Props = {
  hostelId: string;
  floor: Floor;
  onSaved: () => Promise<void>;
  /** All saved rooms for this floor — shown with correct occupancy/color */
  floorRooms?: Room[];
  /** Room numbers saved on OTHER floors — used to flag cross-floor duplicates */
  existingRoomNumbers?: string[];
};

const MIN_ROOM_INDEX = 1;
const MAX_ROOM_INDEX = 200;
const MAX_PREFIX_LENGTH = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePrefix(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_PREFIX_LENGTH);
}

function normalizeRoomNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function parseIntOrFallback(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateRooms(
  floorId: string,
  prefix: string,
  start: number,
  end: number,
  defaultCapacity: number,
): DraftRoom[] {
  const rooms: DraftRoom[] = [];
  for (let i = start; i <= end; i++) {
    const num = String(i).padStart(2, "0");
    const roomNumber = `${prefix}${num}`;
    rooms.push({
      localId: `${floorId}-${roomNumber}`,
      floorId,
      roomNumber,
      capacity: defaultCapacity,
    });
  }
  return rooms;
}

export function FloorRoomGenerator({
  hostelId,
  floor,
  onSaved,
  floorRooms = [],
  existingRoomNumbers = [],
}: Props) {
  const [prefix, setPrefix] = useState(() => {
    // Auto-derive prefix from floor name
    const name = floor.name.toLowerCase();
    if (name.includes("ground")) return "G";
    if (name.includes("basement")) return "B";
    const match = floor.name.match(/(\d+)/);
    return match ? match[1] : floor.name.slice(0, 1).toUpperCase();
  });
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(8);
  const [defaultCapacity, setDefaultCapacity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  const normalizedPrefix = useMemo(() => normalizePrefix(prefix) || "R", [prefix]);

  const clampedStart = clamp(start, MIN_ROOM_INDEX, MAX_ROOM_INDEX);
  const clampedEnd = clamp(
    Math.max(end, clampedStart),
    clampedStart,
    MAX_ROOM_INDEX,
  );
  const batchSize = clampedEnd - clampedStart + 1;
  const batchStartLabel = `${normalizedPrefix}${String(clampedStart).padStart(2, "0")}`;
  const batchEndLabel = `${normalizedPrefix}${String(clampedEnd).padStart(2, "0")}`;

  // O(1) lookup: which room numbers already exist (this floor + other floors)
  const existingSet = useMemo(() => {
    const s = new Set(existingRoomNumbers.map((n) => n.toLowerCase()));
    floorRooms.forEach((r) => s.add(r.room_number.toLowerCase()));
    return s;
  }, [existingRoomNumbers, floorRooms]);

  // Map room_number (lowercase) -> saved Room so duplicates can show real capacity
  const savedRoomMap = useMemo(
    () => new Map(floorRooms.map((r) => [r.room_number.toLowerCase(), r])),
    [floorRooms],
  );

  const nextStartSuggestion = useMemo(() => {
    const pattern = new RegExp(`^${escapeRegExp(normalizedPrefix)}(\\d+)$`, "i");
    let highest = 0;
    for (const room of floorRooms) {
      const match = normalizeRoomNumber(room.room_number).match(pattern);
      if (!match) continue;
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > highest) {
        highest = parsed;
      }
    }
    return clamp(highest + 1, MIN_ROOM_INDEX, MAX_ROOM_INDEX);
  }, [floorRooms, normalizedPrefix]);

  // Live preview rooms
  const previewRooms = useMemo(() => {
    return generateRooms(
      floor.id,
      normalizedPrefix,
      clampedStart,
      clampedEnd,
      defaultCapacity,
    );
  }, [floor.id, normalizedPrefix, clampedStart, clampedEnd, defaultCapacity]);

  function updateDraftCapacity(localId: string, capacity: number) {
    setOverrides((prev) => ({ ...prev, [localId]: capacity }));
  }

  // Per-room capacity overrides
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const allPreview = useMemo(
    () =>
      previewRooms
        .filter((r) => !removed.has(r.localId))
        .map((r) => ({ ...r, capacity: overrides[r.localId] ?? r.capacity })),
    [previewRooms, overrides, removed],
  );

  // Split into genuinely new vs duplicates
  const { newRooms, dupCount } = useMemo(() => {
    const newRooms: DraftRoom[] = [];
    let dupCount = 0;
    for (const r of allPreview) {
      if (existingSet.has(r.roomNumber.toLowerCase())) {
        dupCount++;
      } else {
        newRooms.push(r);
      }
    }
    return { newRooms, dupCount };
  }, [allPreview, existingSet]);

  async function saveRooms() {
    if (saving || locked) return;

    if (newRooms.length === 0) {
      toast.error(dupCount > 0 ? "All rooms already exist." : "No rooms to save.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/hostels/${hostelId}/rooms/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rooms: newRooms.map((r) => ({
            floorId: r.floorId,
            roomNumber: r.roomNumber,
            capacity: r.capacity,
          })),
        }),
      });

      let payload: {
        error?: string;
        skipped?: number;
        inserted?: number;
      } | null = null;
      try {
        payload = (await res.json()) as {
          error?: string;
          skipped?: number;
          inserted?: number;
        };
      } catch {
        payload = null;
      }

      if (!res.ok) {
        toast.error(payload?.error ?? "Failed to save rooms.");
        return;
      }

      const skipped = payload?.skipped ?? 0;
      const inserted = payload?.inserted ?? 0;
      if (inserted === 0) {
        toast.info("All rooms already exist — nothing added.");
      } else {
        toast.success(
          `${inserted} room${inserted !== 1 ? "s" : ""} added${skipped > 0 ? ` (${skipped} skipped)` : ""}.`,
        );
      }

      setOverrides({});
      setRemoved(new Set());
      setLocked(true);
      await onSaved();
    } catch {
      toast.error("Network error while saving rooms.");
    } finally {
      setSaving(false);
    }
  }

  // Per-room capacity override options (1-6)
  const capacityOptions = [1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-1 sm:p-1">
      {/* Floor context header */}
      <div className="flex items-center gap-2 pt-3">
        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
          {floor.name}
        </span>
        <span className="text-xs text-muted-foreground">— quick room generator</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Create a room batch, click Save, then use{" "}
        <span className="font-semibold">Start Next Batch</span> to continue with the
        next range.
      </p>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor={`prefix-${floor.id}`} className="text-xs">
            Room Prefix
          </Label>
          <Input
            id={`prefix-${floor.id}`}
            value={prefix}
            onChange={(e) => setPrefix(normalizePrefix(e.target.value))}
            className="h-9 text-sm"
            placeholder="G"
            maxLength={MAX_PREFIX_LENGTH}
            disabled={saving || locked}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`start-${floor.id}`} className="text-xs">
            From #
          </Label>
          <Input
            id={`start-${floor.id}`}
            type="number"
            min={MIN_ROOM_INDEX}
            max={MAX_ROOM_INDEX}
            value={start}
            onChange={(e) => {
              const nextStart = clamp(
                parseIntOrFallback(e.target.value, MIN_ROOM_INDEX),
                MIN_ROOM_INDEX,
                MAX_ROOM_INDEX,
              );
              setStart(nextStart);
              setEnd((prev) =>
                clamp(Math.max(prev, nextStart), nextStart, MAX_ROOM_INDEX),
              );
            }}
            className="h-9 text-sm"
            disabled={saving || locked}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`end-${floor.id}`} className="text-xs">
            To #
          </Label>
          <Input
            id={`end-${floor.id}`}
            type="number"
            min={start}
            max={MAX_ROOM_INDEX}
            value={end}
            onChange={(e) => {
              const nextEnd = clamp(
                parseIntOrFallback(e.target.value, start),
                start,
                MAX_ROOM_INDEX,
              );
              setEnd(nextEnd);
            }}
            className="h-9 text-sm"
            disabled={saving || locked}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Default Occupancy</Label>
          <div className="flex flex-wrap items-center gap-1">
            {OCCUPANCY_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.label}
                onClick={() => setDefaultCapacity(p.value)}
                disabled={saving || locked}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                  defaultCapacity === p.value
                    ? occupancyColor(p.value) + " ring-2 ring-offset-1"
                    : "border-border/60 hover:border-primary/40"
                }`}
              >
                {p.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${occupancyColor(defaultCapacity)}`}
        >
          {occupancyLabel(defaultCapacity)} occupancy selected
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span>{newRooms.length} new rooms</span>
        {dupCount > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {dupCount} already exist (will be skipped)
            </span>
          </>
        )}
        {locked && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-medium text-primary">
              Saved and locked. Click Start Next Batch to continue.
            </span>
          </>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs">
        <p className="font-semibold text-foreground">
          Batch: {batchStartLabel} to {batchEndLabel} ({batchSize} room
          {batchSize !== 1 ? "s" : ""})
        </p>
        <p className="text-muted-foreground">
          {newRooms.length > 0
            ? `${newRooms.length} room${newRooms.length !== 1 ? "s" : ""} will be saved now.`
            : dupCount > 0
              ? "No new rooms in this range. Change range or prefix to continue."
              : "No draft rooms ready to save yet."}
          {dupCount > 0
            ? ` ${dupCount} duplicate room${dupCount !== 1 ? "s" : ""} will be skipped.`
            : ""}
        </p>
      </div>

      {/* Draft preview — new rooms only */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {allPreview.map((room) => {
          const isDuplicate = existingSet.has(room.roomNumber.toLowerCase());
          const savedRoom = isDuplicate
            ? savedRoomMap.get(room.roomNumber.toLowerCase())
            : undefined;
          return (
            <div key={room.localId} className="relative">
              {savedRoom ? (
                // Existing room — same size as DraftRoomCard, real occupancy, slightly grayed
                <div
                  className={`relative flex min-w-[112px] flex-col gap-1 rounded-xl border p-3 opacity-50 select-none ${occupancyColor(savedRoom.capacity)}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-sm leading-tight">
                      {savedRoom.room_number}
                    </span>
                  </div>
                  <span className="text-2xl leading-none opacity-70">
                    {bedIcons(savedRoom.capacity)}
                  </span>
                  <span className="mt-1 w-full rounded-lg border border-current/30 px-1.5 py-1 text-xs font-semibold text-center">
                    {savedRoom.capacity} bed{savedRoom.capacity !== 1 ? "s" : ""}
                  </span>
                  <span className="absolute bottom-1 right-1 rounded-sm bg-yellow-900 px-1 text-[8px] font-bold text-yellow-100 dark:bg-yellow-100 dark:text-yellow-900">
                    exists
                  </span>
                </div>
              ) : (
                <DraftRoomCard
                  room={room}
                  capacityOptions={capacityOptions}
                  disabled={locked}
                  onChangeCapacity={updateDraftCapacity}
                  onRemove={(localId) =>
                    setRemoved((prev) => new Set(Array.from(prev).concat(localId)))
                  }
                />
              )}
            </div>
          );
        })}
        {removed.size > 0 && (
          <button
            type="button"
            onClick={() => setRemoved(new Set())}
            disabled={saving || locked}
            className="col-span-full text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Restore {removed.size} removed room{removed.size !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Save / reset actions */}
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <Button
          size="sm"
          className="w-full rounded-xl gap-2 px-3 py-2 text-sm sm:w-auto"
          onClick={saveRooms}
          disabled={saving || locked || newRooms.length === 0}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {saving ? "Saving…" : `Save ${newRooms.length} rooms to ${floor.name}`}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (locked) {
              const rangeSize = clamp(
                end - start + 1,
                MIN_ROOM_INDEX,
                MAX_ROOM_INDEX,
              );
              const nextStart = nextStartSuggestion;
              const nextEnd = clamp(
                nextStart + rangeSize - 1,
                nextStart,
                MAX_ROOM_INDEX,
              );
              setStart(nextStart);
              setEnd(nextEnd);

              if (nextStart === MAX_ROOM_INDEX && nextEnd === MAX_ROOM_INDEX) {
                toast.info(
                  "Reached the room number limit for this prefix. Change prefix or range.",
                );
              }
            }

            setOverrides({});
            setRemoved(new Set());
            setLocked(false);
          }}
          disabled={saving}
          className={`w-full rounded-xl px-3 py-2 text-[11px] sm:w-auto sm:text-xs ${
            locked ? "font-semibold text-primary" : "text-muted-foreground"
          }`}
        >
          {locked ? "Start Next Batch" : "Reset Draft"}
        </Button>
      </div>
    </div>
  );
}
