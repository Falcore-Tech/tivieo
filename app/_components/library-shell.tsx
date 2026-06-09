"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, SearchX, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateGroupLabel } from "@/lib/utils";
import type { Collection, LibraryRecording } from "@/lib/types";
import { LibraryToolbar, type SortKey } from "./library-toolbar";
import { useStoredView } from "./use-stored-view";
import { CollectionsSidebar } from "./collections-sidebar";
import { StorageMeter } from "./storage-meter";
import { TagFilter } from "./tag-filter";
import { SelectionBar } from "./selection-bar";
import { RecordingCard } from "./recording-card";
import { RecordingRow } from "./recording-row";
import { EmptyState } from "./empty-state";

const PAGE_SIZE = 12;

type Props = {
  recordings: LibraryRecording[];
  collections: Collection[];
  storageUsedBytes: number;
};

export function LibraryShell({
  recordings,
  collections,
  storageUsedBytes,
}: Props) {
  const [scope, setScope] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useStoredView();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  function changeScope(next: string) {
    setScope(next);
    setSelected(new Set());
    setActiveTag(null);
    setVisibleCount(PAGE_SIZE);
  }

  const isTrash = scope === "trash";

  const scoped = useMemo(
    () =>
      recordings.filter((recording) => {
        if (isTrash) return recording.deleted_at !== null;
        if (recording.deleted_at !== null) return false;
        if (scope !== "all" && recording.collection_id !== scope) return false;
        return true;
      }),
    [recordings, scope, isTrash],
  );

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    scoped.forEach((recording) =>
      recording.tags.forEach((tag) => set.add(tag)),
    );
    return Array.from(set).sort();
  }, [scoped]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = scoped.filter((recording) => {
      if (activeTag && !recording.tags.includes(activeTag)) return false;
      if (term && !recording.title.toLowerCase().includes(term)) return false;
      return true;
    });
    return list.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.created_at.localeCompare(b.created_at);
        case "title":
          return a.title.localeCompare(b.title);
        case "longest":
          return (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0);
        case "largest":
          return (b.size_bytes ?? 0) - (a.size_bytes ?? 0);
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
  }, [scoped, activeTag, query, sort]);

  const { counts, trashCount } = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    collections.forEach((collection) => (map[collection.id] = 0));
    let trash = 0;
    recordings.forEach((recording) => {
      if (recording.deleted_at !== null) {
        trash += 1;
        return;
      }
      map.all += 1;
      if (recording.collection_id && map[recording.collection_id] !== undefined) {
        map[recording.collection_id] += 1;
      }
    });
    return { counts: map, trashCount: trash };
  }, [recordings, collections]);

  const grouped = useMemo(() => {
    const visible = filtered.slice(0, visibleCount);
    if (sort !== "newest" && sort !== "oldest") {
      return [{ label: null as string | null, items: visible }];
    }
    const map = new Map<string, LibraryRecording[]>();
    visible.forEach((recording) => {
      const label = dateGroupLabel(recording.created_at);
      const items = map.get(label) ?? [];
      items.push(recording);
      map.set(label, items);
    });
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [filtered, visibleCount, sort]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectMode() {
    const next = !selectMode;
    setSelectMode(next);
    if (!next) setSelected(new Set());
  }

  const scopeTitle = isTrash
    ? "Trash"
    : scope === "all"
      ? "Your recordings"
      : (collections.find((collection) => collection.id === scope)?.name ??
        "Folder");

  return (
    <main className="mx-auto w-full max-w-page flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[210px_1fr] lg:gap-8">
        <aside className="mb-6 space-y-4 lg:sticky lg:top-20 lg:mb-0 lg:self-start">
          <CollectionsSidebar
            collections={collections}
            counts={counts}
            trashCount={trashCount}
            scope={scope}
            onScopeChange={changeScope}
          />
          <StorageMeter usedBytes={storageUsedBytes} />
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {scopeTitle}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {filtered.length} recording{filtered.length === 1 ? "" : "s"}
              </p>
            </div>
            <Button asChild>
              <Link href="/record">
                <Plus className="size-4" /> New recording
              </Link>
            </Button>
          </div>

          <div className="space-y-3">
            <LibraryToolbar
              query={query}
              onQueryChange={(value) => {
                setQuery(value);
                setVisibleCount(PAGE_SIZE);
              }}
              sort={sort}
              onSortChange={(value) => {
                setSort(value);
                setVisibleCount(PAGE_SIZE);
              }}
              view={view}
              onViewChange={setView}
              selectMode={selectMode}
              onToggleSelectMode={toggleSelectMode}
            />
            <TagFilter
              tags={availableTags}
              active={activeTag}
              onChange={(tag) => {
                setActiveTag(tag);
                setVisibleCount(PAGE_SIZE);
              }}
            />
            {selectMode && selectedIds.length > 0 ? (
              <SelectionBar
                selectedIds={selectedIds}
                scope={isTrash ? "trash" : "active"}
                collections={collections}
                onClear={() => {
                  setSelected(new Set());
                  setSelectMode(false);
                }}
              />
            ) : null}
          </div>

          <div className="mt-6">
            {recordings.length === 0 ? (
              <EmptyState
                icon={<Video className="size-6" />}
                title="No recordings yet"
                description="Record your screen and webcam, then share an instant link. Your library lives here."
                action={
                  <Button asChild>
                    <Link href="/record">
                      <Plus className="size-4" /> Create your first recording
                    </Link>
                  </Button>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="Nothing matches"
                description={
                  isTrash
                    ? "Trash is empty. Deleted recordings will appear here."
                    : "No recordings match your search and filters."
                }
                action={
                  !isTrash ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery("");
                        setActiveTag(null);
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {grouped.map((group) => (
                  <section key={group.label ?? "results"} className="mb-7">
                    {group.label ? (
                      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </h2>
                    ) : null}
                    {view === "grid" ? (
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {group.items.map((recording) => (
                          <RecordingCard
                            key={recording.id}
                            recording={recording}
                            scope={isTrash ? "trash" : "active"}
                            selectMode={selectMode}
                            selected={selected.has(recording.id)}
                            onToggleSelect={toggleSelect}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {group.items.map((recording) => (
                          <RecordingRow
                            key={recording.id}
                            recording={recording}
                            scope={isTrash ? "trash" : "active"}
                            selectMode={selectMode}
                            selected={selected.has(recording.id)}
                            onToggleSelect={toggleSelect}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}

                {visibleCount < filtered.length ? (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setVisibleCount((count) => count + PAGE_SIZE)
                      }
                    >
                      Load more
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
