"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Globe, Link2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { RecordingVisibility } from "@/lib/types";
import { setVisibility } from "../_actions";

const VISIBILITY_META: Record<
  RecordingVisibility,
  { label: string; icon: typeof Globe }
> = {
  public: { label: "Public", icon: Globe },
  unlisted: { label: "Unlisted", icon: Link2 },
  private: { label: "Private", icon: Lock },
};

type Props = {
  slug: string;
  visibility: RecordingVisibility;
  isOwner: boolean;
};

export function ShareBar({ slug, visibility, isOwner }: Props) {
  const [current, setCurrent] = useState(visibility);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const Meta = VISIBILITY_META[current];

  async function handleCopy() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleVisibility(next: RecordingVisibility) {
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      const result = await setVisibility(slug, next);
      if (result.error) {
        setCurrent(previous);
        toast.error(result.error);
      } else {
        toast.success(`Visibility set to ${VISIBILITY_META[next].label}`);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {isOwner ? (
        <Select
          value={current}
          onValueChange={(value) =>
            handleVisibility(value as RecordingVisibility)
          }
          disabled={pending}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(VISIBILITY_META) as RecordingVisibility[]).map((key) => (
              <SelectItem key={key} value={key}>
                {VISIBILITY_META[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="secondary" className="gap-1.5">
          <Meta.icon className="size-3.5" />
          {Meta.label}
        </Badge>
      )}

      <Button variant="secondary" size="sm" onClick={handleCopy}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        Copy link
      </Button>
    </div>
  );
}
