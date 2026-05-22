// Occupancy label + colour helpers shared across setup components

import type { OccupancyType, RoomStatus } from "./types";

/** Bulk-generator default occupancy (1-4) */
export const OCCUPANCY_PRESETS: {
  value: OccupancyType;
  label: string;
  short: string;
}[] = [
  { value: 1, label: "Single", short: "1" },
  { value: 2, label: "Double", short: "2" },
  { value: 3, label: "Triple", short: "3" },
  { value: 4, label: "Quad", short: "4" },
];

/** Per-room occupancy options (1-6) */
export const OCCUPANCY_PER_ROOM: {
  value: number;
  label: string;
}[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
];

/** Room status visual config */
export const STATUS_CONFIG: Record<
  RoomStatus,
  { label: string; color: string; dot: string }
> = {
  vacant: {
    label: "Vacant",
    color:
      "bg-emerald-500/10 text-emerald-700 border-emerald-400/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  occupied: {
    label: "Occupied",
    color: "bg-blue-500/10 text-blue-700 border-blue-400/40 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  maintenance: {
    label: "Maintenance",
    color: "bg-amber-500/10 text-amber-700 border-amber-400/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  inactive: {
    label: "Inactive",
    color: "bg-zinc-500/10 text-zinc-500 border-zinc-400/40 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

export function occupancyColor(capacity: number): string {
  if (capacity === 1)
    return "bg-sky-500/15 border-sky-400/50 text-sky-700 dark:text-sky-300";
  if (capacity === 2)
    return "bg-violet-500/15 border-violet-400/50 text-violet-700 dark:text-violet-300";
  if (capacity === 3)
    return "bg-amber-500/15 border-amber-400/50 text-amber-700 dark:text-amber-300";
  if (capacity === 4)
    return "bg-rose-500/15 border-rose-400/50 text-rose-700 dark:text-rose-300";
  return "bg-emerald-500/15 border-emerald-400/50 text-emerald-700 dark:text-emerald-300";
}

export function occupancyLabel(capacity: number): string {
  if (capacity === 1) return "Single";
  if (capacity === 2) return "Double";
  if (capacity === 3) return "Triple";
  if (capacity === 4) return "Quad";
  return `${capacity}-bed`;
}

export function bedIcons(capacity: number): string {
  const icon = "🛏";
  if (capacity <= 3) return icon.repeat(capacity);
  return `${icon}×${capacity}`;
}

// Generate auto floor names for building shell stage
export function autoFloorName(index: number): string {
  if (index < 0) return `Basement ${Math.abs(index)}`;
  if (index === 0) return "Ground Floor";
  if (index === 1) return "First Floor";
  if (index === 2) return "Second Floor";
  if (index === 3) return "Third Floor";
  return `${index}th Floor`;
}

// Generate auto room number prefix from floor name
export function autoPrefix(floorName: string, index: number): string {
  if (index < 0) return "B";
  if (index === 0) return "G";
  return String(index);
}
