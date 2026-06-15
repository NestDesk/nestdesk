"use client";

import { useIdleTimeout } from "../../hooks/use-idle-timeout";

/**
 * Invisible client component that enforces the 30-min idle session timeout.
 * Drop it anywhere inside the authenticated layout and it will sign the user
 * out automatically after 30 minutes of inactivity.
 */
export function IdleTimeoutEnforcer() {
  useIdleTimeout();
  return null;
}
