const INDIA_TIME_ZONE = "Asia/Kolkata";
const INDIA_TIME_ZONE_OFFSET = "+05:30";

function parseDate(value?: string | Date | null): Date | null {
  if (value == null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatParts(date: Date, options: Intl.DateTimeFormatOptions) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    ...options,
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
}

export function formatDateInIndia(
  value: string | Date | null,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    ...options,
  });
}

export function formatDateTimeInIndia(
  value: string | Date | null,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
) {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleString("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    ...options,
  });
}

export function toIndianDateString(date: Date = new Date()) {
  const parts = formatParts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toIndianISOString(date: Date = new Date()) {
  const parts = formatParts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${INDIA_TIME_ZONE_OFFSET}`;
}

export function toIndianDate(value: string | Date | null): string | null {
  const date = parseDate(value);
  if (!date) return null;
  return toIndianDateString(date);
}
