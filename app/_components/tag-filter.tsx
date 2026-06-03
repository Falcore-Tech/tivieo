"use client";

import { Badge } from "@/components/ui/badge";

type Props = {
  tags: string[];
  active: string | null;
  onChange: (tag: string | null) => void;
};

export function TagFilter({ tags, active, onChange }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onChange(active === tag ? null : tag)}
        >
          <Badge
            variant={active === tag ? "default" : "outline"}
            className="cursor-pointer font-normal"
          >
            {tag}
          </Badge>
        </button>
      ))}
    </div>
  );
}
