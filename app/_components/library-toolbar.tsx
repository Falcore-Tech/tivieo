"use client";

import { LayoutGrid, ListChecks, Rows3, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SortKey = "newest" | "oldest" | "title" | "longest" | "largest";
export type ViewMode = "grid" | "list";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  title: "Title A–Z",
  longest: "Longest",
  largest: "Largest file",
};

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
  view: ViewMode;
  onViewChange: (value: ViewMode) => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
};

export function LibraryToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  selectMode,
  onToggleSelectMode,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-50 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="library-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search recordings"
          className="pl-9"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <Select value={sort} onValueChange={(value) => onSortChange(value as SortKey)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center rounded-md border border-border p-0.5">
        <Button
          variant={view === "grid" ? "secondary" : "ghost"}
          size="icon"
          className="size-8"
          onClick={() => onViewChange("grid")}
          aria-label="Grid view"
          aria-pressed={view === "grid"}
        >
          <LayoutGrid className="size-4" />
        </Button>
        <Button
          variant={view === "list" ? "secondary" : "ghost"}
          size="icon"
          className="size-8"
          onClick={() => onViewChange("list")}
          aria-label="List view"
          aria-pressed={view === "list"}
        >
          <Rows3 className="size-4" />
        </Button>
      </div>

      <Button
        variant={selectMode ? "secondary" : "outline"}
        size="sm"
        onClick={onToggleSelectMode}
        className={cn(selectMode && "border-transparent")}
      >
        <ListChecks className="size-4" />
        Select
      </Button>
    </div>
  );
}
