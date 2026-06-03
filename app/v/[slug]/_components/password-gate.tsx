"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyRecordingPassword } from "../_actions";

export function PasswordGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!password.trim()) return;
    startTransition(async () => {
      const result = await verifyRecordingPassword(slug, password);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Lock className="size-6" />
      </span>
      <div>
        <h1 className="text-lg font-semibold">This recording is protected</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the password to watch it.
        </p>
      </div>
      <div className="flex w-full gap-2">
        <Input
          type="password"
          value={password}
          autoFocus
          placeholder="Password"
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
        />
        <Button onClick={submit} disabled={pending || !password.trim()}>
          Unlock
        </Button>
      </div>
    </div>
  );
}
