"use client";

import { useEffect, useState } from "react";
import { Building2, Pencil, Trash2, Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  occupancyColor,
  occupancyLabel,
  bedIcons,
  OCCUPANCY_PER_ROOM,
  STATUS_CONFIG,
} from "./helpers";
import type { Floor, Room, RoomStatus } from "./types";

type Props = {
  hostelId: string;
  floors: Floor[];
  rooms: Room[];
  onSync: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
};

type EditingRoom = {
  roomNumber: string;
  capacity: number;
  status: RoomStatus;
};

export function BuildingBlueprint({
  hostelId,
  floors,
  rooms,
  onSync,
  onDirtyChange,
}: Props) {
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editingFloorName, setEditingFloorName] = useState("");
  const [savingFloorId, setSavingFloorId] = useState<string | null>(null);
  const [deletingFloorId, setDeletingFloorId] = useState<string | null>(null);
  const [floorNameError, setFloorNameError] = useState("");

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<EditingRoom>({
    roomNumber: "",
    capacity: 1,
    status: "vacant",
  });
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [quickSavingRoomId, setQuickSavingRoomId] = useState<string | null>(
    null,
  );
  const hasDraftEdits = editingFloorId !== null || editingRoomId !== null;

  useEffect(() => {
    onDirtyChange?.(hasDraftEdits);
    return () => onDirtyChange?.(false);
  }, [hasDraftEdits, onDirtyChange]);

  useEffect(() => {
    if (!hasDraftEdits) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDraftEdits]);

  async function parsePayload(
    response: Response,
  ): Promise<{ error?: string } | null> {
    try {
      return (await response.json()) as { error?: string };
    } catch {
      return null;
    }
  }

  async function quickUpdateCapacity(room: Room, newCapacity: number) {
    if (quickSavingRoomId || room.capacity === newCapacity) return;
    const occupancy = room.occupancy ?? 0;
    if (newCapacity < occupancy) {
      toast.error(
        `Capacity cannot be reduced below current tenant count (${occupancy}).`,
      );
      return;
    }
    setQuickSavingRoomId(room.id);
    try {
      const res = await fetch(`/api/hostels/${hostelId}/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floorId: room.floor_id,
          roomNumber: room.room_number,
          capacity: newCapacity,
          rentAmount: room.rent_amount,
          status: room.status,
        }),
      });
      const payload = await parsePayload(res);
      if (!res.ok) {
        toast.error(payload?.error ?? "Failed to update capacity.");
        return;
      }
      await onSync();
    } catch {
      toast.error("Network error.");
    } finally {
      setQuickSavingRoomId(null);
    }
  }

  // ── Floor actions ─────────────────────────────────────────────────────────

  function startFloorEdit(floor: Floor) {
    setEditingFloorId(floor.id);
    setEditingFloorName(floor.name);
    setFloorNameError("");
  }

  async function saveFloorEdit(floorId: string) {
    const name = editingFloorName.trim();
    if (!name) {
      setFloorNameError("Floor name is required.");
      return;
    }

    // Duplicate check against other floors
    const isDuplicate = floors.some(
      (f) => f.id !== floorId && f.name.toLowerCase() === name.toLowerCase(),
    );
    if (isDuplicate) {
      setFloorNameError(`A floor named "${name}" already exists.`);
      return;
    }

    setFloorNameError("");
    setSavingFloorId(floorId);
    try {
      const res = await fetch(`/api/hostels/${hostelId}/floors/${floorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await parsePayload(res);
      if (!res.ok) {
        toast.error(payload?.error ?? "Failed to update floor.");
        return;
      }
      setEditingFloorId(null);
      await onSync();
      toast.success("Floor renamed.");
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingFloorId(null);
    }
  }

  async function deleteFloor(floorId: string) {
    if (deletingFloorId) return;

    const roomCount = rooms.filter((r) => r.floor_id === floorId).length;
    const confirmed = window.confirm(
      roomCount > 0
        ? `Delete this floor and ${roomCount} room${roomCount !== 1 ? "s" : ""}? This cannot be undone.`
        : "Delete this floor? This cannot be undone.",
    );
    if (!confirmed) return;

    setDeletingFloorId(floorId);
    try {
      const res = await fetch(`/api/hostels/${hostelId}/floors/${floorId}`, {
        method: "DELETE",
      });
      const payload = await parsePayload(res);
      if (!res.ok) {
        toast.error(payload?.error ?? "Failed to delete floor.");
        return;
      }
      await onSync();
      toast.success("Floor deleted.");
    } catch {
      toast.error("Network error.");
    } finally {
      setDeletingFloorId(null);
    }
  }

  // ── Room actions ──────────────────────────────────────────────────────────

  function startRoomEdit(room: Room) {
    setEditingRoomId(room.id);
    setEditingRoom({
      roomNumber: room.room_number,
      capacity: room.capacity,
      status: room.status,
    });
  }

  async function saveRoomEdit(room: Room) {
    const roomNumber = editingRoom.roomNumber.trim().toUpperCase();
    const occupancy = room.occupancy ?? 0;
    if (editingRoom.capacity < occupancy) {
      toast.error(
        `Capacity cannot be reduced below current tenant count (${occupancy}).`,
      );
      return;
    }
    if (occupancy > 0 && editingRoom.status !== room.status) {
      toast.error(
        "Room status cannot be changed while tenants occupy the room.",
      );
      return;
    }
    if (!roomNumber) {
      toast.error("Enter room number.");
      return;
    }

    // Duplicate room number check (other rooms on this property)
    const isDuplicate = rooms.some(
      (r) =>
        r.id !== room.id &&
        r.room_number.toLowerCase() === roomNumber.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error(`Room "${roomNumber}" already exists in this property.`);
      return;
    }

    setSavingRoomId(room.id);
    try {
      const res = await fetch(`/api/hostels/${hostelId}/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floorId: room.floor_id,
          roomNumber,
          capacity: editingRoom.capacity,
          rentAmount: room.rent_amount,
          status: editingRoom.status,
        }),
      });
      const payload = await parsePayload(res);
      if (!res.ok) {
        toast.error(payload?.error ?? "Failed to update room.");
        return;
      }
      setEditingRoomId(null);
      await onSync();
      toast.success("Room updated.");
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingRoomId(null);
    }
  }

  async function deleteRoom(roomId: string, roomNumber: string) {
    if (deletingRoomId) return;

    const confirmed = window.confirm(
      `Delete room ${roomNumber}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingRoomId(roomId);
    try {
      const res = await fetch(`/api/hostels/${hostelId}/rooms/${roomId}`, {
        method: "DELETE",
      });
      const payload = await parsePayload(res);
      if (!res.ok) {
        toast.error(payload?.error ?? "Failed to delete room.");
        return;
      }
      await onSync();
      toast.success("Room deleted.");
    } catch {
      toast.error("Network error.");
    } finally {
      setDeletingRoomId(null);
    }
  }

  const capacitiesPresent = Array.from(
    new Set(rooms.map((r) => r.capacity)),
  ).sort((a, b) => a - b);

  if (floors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-16 text-center">
        <Building2 className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          Your property blueprint will appear here.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Add floors and rooms in the wizard above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasDraftEdits && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          You have unsaved edits in blueprint. Save or cancel them before
          leaving this step.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 className="h-4 w-4 text-primary" />
          Property Blueprint
        </h3>
        <span className="text-xs text-muted-foreground">
          {rooms.length} rooms · {floors.length} floors
        </span>
      </div>

      {/* Blueprint — floors stacked, ground at bottom */}
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="flex min-w-max flex-col-reverse gap-4">
          {floors.map((floor) => {
            const floorRooms = rooms
              .filter((r) => r.floor_id === floor.id)
              .sort((a, b) =>
                a.room_number.localeCompare(b.room_number, undefined, {
                  numeric: true,
                  sensitivity: "base",
                }),
              );
            const isEditingThisFloor = editingFloorId === floor.id;

            return (
              <div key={floor.id} className="flex flex-col gap-2">
                {/* Floor label row */}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/60" />
                  {isEditingThisFloor ? (
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-1.5">
                        <Input
                          className="h-7 w-44 text-xs"
                          value={editingFloorName}
                          onChange={(e) => {
                            setEditingFloorName(e.target.value);
                            setFloorNameError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveFloorEdit(floor.id);
                            if (e.key === "Escape") setEditingFloorId(null);
                          }}
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-600"
                          disabled={!!savingFloorId}
                          onClick={() => saveFloorEdit(floor.id)}
                        >
                          {savingFloorId === floor.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingFloorId(null);
                            setFloorNameError("");
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {floorNameError && (
                        <p className="text-[10px] text-destructive">
                          {floorNameError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="group flex items-center gap-1 px-2">
                      <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
                        {floor.name}
                        <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          {floorRooms.length}
                        </span>
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => startFloorEdit(floor)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          disabled={deletingFloorId === floor.id}
                          onClick={() => deleteFloor(floor.id)}
                        >
                          {deletingFloorId === floor.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                {/* Rooms row */}
                {floorRooms.length === 0 ? (
                  <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-border/50 text-xs text-muted-foreground/50">
                    No rooms yet
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {floorRooms.map((room) => {
                      const occColor = occupancyColor(room.capacity);
                      const statusCfg = STATUS_CONFIG[room.status];
                      const isEditingThis = editingRoomId === room.id;
                      const isInactive = room.status === "inactive";
                      const occupancy = room.occupancy ?? 0;
                      const cannotDeleteRoom =
                        occupancy > 0 ||
                        room.status === "occupied" ||
                        room.status === "occupied_partial";
                      const statusChangeDisabled = occupancy > 0;

                      return (
                        <div
                          key={room.id}
                          className={`group relative rounded-xl border transition-shadow hover:shadow-md ${
                            isEditingThis ? "w-56 p-3" : "w-36 p-3"
                          } ${isInactive ? "opacity-50" : ""} ${occColor}`}
                        >
                          {isEditingThis ? (
                            /* ── Edit tile ─────────────────────────────── */
                            <div className="space-y-2">
                              <Input
                                className="h-7 text-xs"
                                value={editingRoom.roomNumber}
                                onChange={(e) =>
                                  setEditingRoom((p) => ({
                                    ...p,
                                    roomNumber: e.target.value,
                                  }))
                                }
                                placeholder="Room no."
                              />

                              {/* Occupancy selector */}
                              <div>
                                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide">
                                  Select Room Occupancy
                                </p>
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-0.5">
                                    {OCCUPANCY_PER_ROOM.filter(
                                      (o) => o.value <= 4,
                                    ).map((o) => (
                                      <button
                                        key={o.value}
                                        type="button"
                                        onClick={() =>
                                          setEditingRoom((p) => ({
                                            ...p,
                                            capacity: o.value,
                                          }))
                                        }
                                        disabled={o.value < occupancy}
                                        className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold transition-colors ${
                                          editingRoom.capacity === o.value
                                            ? "bg-foreground text-background"
                                            : "bg-foreground/10 hover:bg-foreground/20"
                                        } ${o.value < occupancy ? "cursor-not-allowed opacity-50" : ""}`}
                                      >
                                        {o.label}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2 py-1">
                                    
                                    <input
                                      type="number"
                                      min={Math.max(1, occupancy)}
                                      max={10}
                                      value={editingRoom.capacity}
                                      onChange={(e) => {
                                        const value = Number.parseInt(
                                          e.target.value,
                                          10,
                                        );
                                        if (Number.isNaN(value)) return;
                                        setEditingRoom((p) => ({
                                          ...p,
                                          capacity: Math.max(
                                            1,
                                            Math.min(10, value),
                                          ),
                                        }));
                                      }}
                                      className="h-8 w-12 rounded-md border border-border/40 bg-background px-2 text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Status dropdown */}
                              <div>
                                <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide">
                                  Select Room Status
                                </p>
                                <select
                                  value={editingRoom.status}
                                  disabled={occupancy > 0}
                                  onChange={(e) =>
                                    setEditingRoom((p) => ({
                                      ...p,
                                      status: e.target.value as RoomStatus,
                                    }))
                                  }
                                  className="w-full rounded-md border border-current bg-transparent px-2 py-1 text-xs font-semibold outline-none focus:ring-1 focus:ring-current/40 disabled:opacity-50"
                                >
                                  <option value="vacant">Vacant</option>
                                  <option value="maintenance">
                                    Maintenance
                                  </option>
                                  <option value="inactive">Inactive</option>
                                </select>
                                {occupancy > 0 ? (
                                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                                    Status cannot be changed while the room has any
                                    active tenants.
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex gap-1 pt-0.5">
                                <Button
                                  size="sm"
                                  className="h-6 flex-1 rounded-lg text-[10px]"
                                  onClick={() => saveRoomEdit(room)}
                                  disabled={!!savingRoomId}
                                >
                                  {savingRoomId === room.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 flex-1 rounded-lg text-[10px]"
                                  onClick={() => setEditingRoomId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* ── View tile ─────────────────────────────── */
                            <>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs leading-tight whitespace-nowrap">
                                  {room.room_number}
                                </span>
                                <div className="flex items-center gap-0 opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    className="h-8 w-8 rounded-full p-1 hover:bg-foreground/10"
                                    onClick={() => startRoomEdit(room)}
                                    aria-label="Edit room"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="h-8 w-8 rounded-full p-1 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                                    disabled={
                                      deletingRoomId === room.id ||
                                      cannotDeleteRoom
                                    }
                                    onClick={() =>
                                      deleteRoom(room.id, room.room_number)
                                    }
                                    aria-label="Delete room"
                                    title={
                                      cannotDeleteRoom
                                        ? "Cannot delete a room with tenants or occupied status."
                                        : "Delete room"
                                    }
                                  >
                                    {deletingRoomId === room.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              {/* Bed count chip */}
                              <div className="mt-2 inline-flex items-center text-[11px] font-semibold">
                                {room.capacity} Bed
                                {room.capacity !== 1 ? "s" : ""}
                              </div>
                              <div className="mt-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${statusCfg.color}`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`}
                                  />
                                  {statusCfg.label}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {capacitiesPresent.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Occupancy
            </span>
            {capacitiesPresent.map((cap) => (
              <div key={cap} className="flex items-center gap-1">
                <span
                  className={`inline-block h-3 w-3 rounded-sm border ${occupancyColor(cap)}`}
                />
                <span className="text-[11px] text-muted-foreground">
                  {occupancyLabel(cap)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Status
            </span>
            {(
              Object.entries(STATUS_CONFIG) as [
                RoomStatus,
                (typeof STATUS_CONFIG)[RoomStatus],
              ][]
            ).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                <span className="text-[11px] text-muted-foreground">
                  {cfg.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
