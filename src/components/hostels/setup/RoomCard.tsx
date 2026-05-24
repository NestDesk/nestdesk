"use client";

import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { occupancyColor, occupancyLabel, bedIcons } from "./helpers";
import type { Room, DraftRoom } from "./types";

// ─── Live room card (DB-backed) ──────────────────────────────────────────────

type LiveRoomCardProps = {
  room: Room;
  onEdit: (room: Room) => void;
  onDelete: (roomId: string) => void;
  deleting?: boolean;
};

export function LiveRoomCard({
  room,
  onEdit,
  onDelete,
  deleting,
}: LiveRoomCardProps) {
  const colorClass = occupancyColor(room.capacity);

  return (
    <div
      className={`group relative flex flex-col gap-1 rounded-xl border p-3 transition-shadow hover:shadow-md ${colorClass}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-bold text-sm leading-tight">{room.room_number}</span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onEdit(room)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={() => onDelete(room.id)}
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
      <span className="text-[11px] leading-none opacity-70">
        {bedIcons(room.capacity)}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-60">
        {occupancyLabel(room.capacity)}
      </span>
    </div>
  );
}

// ─── Draft room card (pre-save preview) ──────────────────────────────────────

type DraftRoomCardProps = {
  room: DraftRoom;
  onChangeCapacity: (localId: string, capacity: number) => void;
  onRemove: (localId: string) => void;
  capacityOptions: number[];
};

export function DraftRoomCard({
  room,
  onChangeCapacity,
  onRemove,
  capacityOptions,
}: DraftRoomCardProps) {
  const colorClass = occupancyColor(room.capacity);

  return (
    <div
      className={`group relative flex min-w-[112px] flex-col gap-1 rounded-xl border p-3 cursor-default select-none ${colorClass}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-bold text-sm leading-tight">{room.roomNumber}</span>
        <button
          type="button"
          className="h-4 w-4 rounded-full text-[10px] leading-none opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
          onClick={() => onRemove(room.localId)}
          aria-label="Remove room"
        >
          ✕
        </button>
      </div>
      <span className="text-2xl leading-none opacity-70">
        {bedIcons(room.capacity)}
      </span>

      {/* Occupancy dropdown — always visible */}
      <select
        value={room.capacity}
        onChange={(e) => onChangeCapacity(room.localId, parseInt(e.target.value))}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 w-full rounded-lg border border-current/30 bg-transparent px-1.5 py-1 text-xs font-semibold outline-none focus:ring-1 focus:ring-current/40"
      >
        {capacityOptions.map((cap) => (
          <option key={cap} value={cap} className="bg-background text-foreground">
            {cap} bed{cap !== 1 ? "s" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
