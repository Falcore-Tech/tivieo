"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setExpiry, setSharePassword } from "../_actions";

type Props = {
  recordingId: string;
  initialHasPassword: boolean;
  initialExpiresAt: string | null;
};

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ShareProtection({
  recordingId,
  initialHasPassword,
  initialExpiresAt,
}: Props) {
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [password, setPassword] = useState("");
  const [expiry, setExpiryValue] = useState(
    toLocalInputValue(initialExpiresAt),
  );
  const [pending, startTransition] = useTransition();

  function savePassword() {
    const value = password.trim();
    if (!value) return;
    startTransition(async () => {
      const result = await setSharePassword(recordingId, value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setHasPassword(true);
      setPassword("");
      toast.success("Password set");
    });
  }

  function removePassword() {
    startTransition(async () => {
      const result = await setSharePassword(recordingId, null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setHasPassword(false);
      toast.success("Password removed");
    });
  }

  function saveExpiry() {
    startTransition(async () => {
      const result = await setExpiry(
        recordingId,
        expiry ? new Date(expiry).toISOString() : null,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(expiry ? "Expiry updated" : "Expiry cleared");
    });
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border p-4">
      <div className="grid gap-2">
        <Label className="flex items-center gap-1.5">
          <Lock className="size-3.5" /> Password
        </Label>
        {hasPassword ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              This recording is password protected.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={removePassword}
              disabled={pending}
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              type="password"
              value={password}
              placeholder="Set a viewing password"
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              variant="outline"
              onClick={savePassword}
              disabled={pending || !password.trim()}
            >
              Set
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="expiry" className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5" /> Link expires
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="expiry"
            type="datetime-local"
            value={expiry}
            onChange={(event) => setExpiryValue(event.target.value)}
            className="w-auto"
          />
          <Button variant="outline" onClick={saveExpiry} disabled={pending}>
            Save
          </Button>
          {expiry ? (
            <Button
              variant="ghost"
              onClick={() => {
                setExpiryValue("");
                startTransition(async () => {
                  await setExpiry(recordingId, null);
                  toast.success("Expiry cleared");
                });
              }}
              disabled={pending}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
