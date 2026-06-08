"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, PowerOff, Trash2 } from "lucide-react";
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

type Props = {
  hostelId: string;
  hostelName: string;
  isActive: boolean;
};

export function PropertyDangerZone({ hostelId, hostelName, isActive }: Props) {
  const router = useRouter();

  // Deactivate state
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function onDeactivate() {
    if (deactivating) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/hostels/${hostelId}/deactivate`, {
        method: "POST",
      });
      let payload: { success?: boolean; message?: string; error?: string } = {};
      try {
        payload = await res.json();
      } catch {
        /* empty */
      }
      if (!res.ok) {
        toast.error(payload.error ?? "Could not deactivate property.");
        return;
      }
      toast.success(payload.message ?? "Property deactivated.");
      setDeactivateOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeactivating(false);
    }
  }

  async function onDelete() {
    if (deleting) return;
    if (deleteConfirmName.trim() !== hostelName.trim()) {
      toast.error("Property name does not match. Please type the exact name.");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/hostels/${hostelId}`, {
        method: "DELETE",
      });
      let payload: { success?: boolean; message?: string; error?: string } = {};
      try {
        payload = await res.json();
      } catch {
        /* empty */
      }
      if (!res.ok) {
        toast.error(payload.error ?? "Could not delete property.");
        return;
      }
      toast.success("Property permanently deleted.");
      router.push("/hostels");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const deleteNameMatches = deleteConfirmName.trim() === hostelName.trim();

  return (
    <>
      {/* ── Danger Zone Card ── */}
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5">
        <div className="flex items-center gap-2 border-b border-destructive/30 px-5 py-4">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
        </div>

        <div className="divide-y divide-destructive/20">
          {/* Deactivate row */}
          {isActive && (
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Make property inactive
                </p>
                <p className="text-xs text-muted-foreground">
                  Stops the property from appearing as active. You can reactivate it
                  any time from the properties list.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeactivateOpen(true)}
              >
                <PowerOff className="mr-2 h-4 w-4" />
                Make Inactive
              </Button>
            </div>
          )}

          {/* Delete row */}
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Delete this property
              </p>
              <p className="text-xs text-muted-foreground">
                Permanently removes the property, all its floors, rooms, and related
                data. This action cannot be undone.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setDeleteConfirmName("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Property
            </Button>
          </div>
        </div>
      </div>

      {/* ── Deactivate Confirmation Dialog ── */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PowerOff className="h-5 w-5 text-destructive" />
              Make Property Inactive
            </DialogTitle>
            <DialogDescription>
              This will mark{" "}
              <strong className="text-foreground">{hostelName}</strong> as inactive.
              Tenants already in the system won&apos;t be removed. You can reactivate
              the property from the properties list at any time.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeactivateOpen(false)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={onDeactivate}
              disabled={deactivating}
            >
              {deactivating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PowerOff className="mr-2 h-4 w-4" />
              )}
              Confirm, Make Inactive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Property Permanently
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will{" "}
                  <strong className="text-foreground">permanently delete</strong>{" "}
                  <strong className="text-foreground">{hostelName}</strong> along
                  with all its floors, rooms, and all related data.
                </p>
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <strong>This action cannot be undone.</strong> All data will be
                  lost immediately.
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm-input" className="text-sm">
              Type{" "}
              <span className="font-semibold text-foreground">{hostelName}</span> to
              confirm:
            </Label>
            <Input
              id="delete-confirm-input"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={hostelName}
              className="rounded-xl"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={onDelete}
              disabled={!deleteNameMatches || deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
