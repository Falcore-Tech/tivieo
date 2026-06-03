"use client";

import { useState, useTransition } from "react";
import { Globe, Link2, Lock } from "lucide-react";
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
  const [pending, startTransition] = useTransition();

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

  if (!isOwner) return null;

  return (
    <Select
      value={current}
      onValueChange={(value) => handleVisibility(value as RecordingVisibility)}
      disabled={pending}
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(VISIBILITY_META) as RecordingVisibility[]).map((key) => {
          const Meta = VISIBILITY_META[key];
          return (
            <SelectItem key={key} value={key}>
              <Meta.icon className="size-3.5 text-muted-foreground" />
              {Meta.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
