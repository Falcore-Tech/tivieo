"use client";

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RecordingVisibility } from "@/lib/types";
import { VISIBILITY, VISIBILITY_ORDER } from "./visibility";

type Props = {
  value: RecordingVisibility;
  onChange: (visibility: RecordingVisibility) => void;
  disabled?: boolean;
};

export function VisibilityMenu({ value, onChange, disabled }: Props) {
  const Meta = VISIBILITY[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1.5 px-2 text-xs font-medium"
        >
          <Meta.icon className="size-3.5" />
          {Meta.label}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {VISIBILITY_ORDER.map((key) => {
          const Item = VISIBILITY[key];
          return (
            <DropdownMenuItem
              key={key}
              onSelect={() => onChange(key)}
              className="gap-2"
            >
              <Item.icon className="size-4 shrink-0" />
              <span className="flex-1">
                <span className="block">{Item.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {Item.description}
                </span>
              </span>
              {key === value ? <Check className="size-4 shrink-0" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
