"use client";

import { useState, useTransition } from "react";
import {
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Collection } from "@/lib/types";
import {
  createCollection,
  deleteCollection,
  renameCollection,
} from "../_actions";

type Props = {
  collections: Collection[];
  counts: Record<string, number>;
  trashCount: number;
  scope: string;
  onScopeChange: (scope: string) => void;
};

export function CollectionsSidebar({
  collections,
  counts,
  trashCount,
  scope,
  onScopeChange,
}: Props) {
  const [editing, setEditing] = useState<Collection | "new" | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Collection | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew() {
    setName("");
    setEditing("new");
  }

  function openRename(collection: Collection) {
    setName(collection.name);
    setEditing(collection);
  }

  function submit() {
    const value = name.trim();
    if (!value) return;
    startTransition(async () => {
      const result =
        editing === "new"
          ? await createCollection(value)
          : editing
            ? await renameCollection(editing.id, value)
            : { error: "Nothing to save." };
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(editing === "new" ? "Folder created" : "Folder renamed");
      setEditing(null);
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      const result = await deleteCollection(target.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Folder deleted");
      if (scope === target.id) onScopeChange("all");
      setDeleting(null);
    });
  }

  return (
    <nav className="flex flex-col gap-1 text-sm">
      <ScopeButton
        active={scope === "all"}
        onClick={() => onScopeChange("all")}
        icon={<Video className="size-4" />}
        label="All recordings"
        count={counts.all ?? 0}
      />

      <div className="mt-3 flex items-center justify-between px-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Folders
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={openNew}
          aria-label="New folder"
        >
          <FolderPlus className="size-4" />
        </Button>
      </div>

      {collections.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">No folders yet.</p>
      ) : (
        collections.map((collection) => (
          <div key={collection.id} className="group/folder flex items-center">
            <ScopeButton
              active={scope === collection.id}
              onClick={() => onScopeChange(collection.id)}
              icon={<Folder className="size-4" />}
              label={collection.name}
              count={counts[collection.id] ?? 0}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 opacity-0 group-hover/folder:opacity-100 data-[state=open]:opacity-100"
                  aria-label={`${collection.name} options`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openRename(collection)}>
                  <Pencil className="size-4" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleting(collection)}
                >
                  <Trash2 className="size-4" /> Delete folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))
      )}

      <div className="mt-3">
        <ScopeButton
          active={scope === "trash"}
          onClick={() => onScopeChange("trash")}
          icon={<Trash2 className="size-4" />}
          label="Trash"
          count={trashCount}
        />
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "New folder" : "Rename folder"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submit()}
              placeholder="e.g. Client demos"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !name.trim()}>
              {editing === "new" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Recordings inside stay in your library, they just leave the folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={pending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}

function ScopeButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        active
          ? "bg-secondary font-medium text-secondary-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}
