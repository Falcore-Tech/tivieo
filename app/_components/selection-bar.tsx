"use client";

import { useState, useTransition } from "react";
import { FolderInput, RotateCcw, Shield, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import type { Collection } from "@/lib/types";
import { VISIBILITY, VISIBILITY_ORDER } from "./visibility";
import {
  bulkSetVisibility,
  deleteRecordingsForever,
  moveToCollection,
  restoreRecordings,
  softDeleteRecordings,
} from "../_actions";

type Props = {
  selectedIds: string[];
  scope: "active" | "trash";
  collections: Collection[];
  onClear: () => void;
};

export function SelectionBar({
  selectedIds,
  scope,
  collections,
  onClear,
}: Props) {
  const [confirmingDestroy, setConfirmingDestroy] = useState(false);
  const [pending, startTransition] = useTransition();
  const count = selectedIds.length;

  function run(
    action: () => Promise<{ error?: string } | { ok: true }>,
    successMessage: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      onClear();
    });
  }

  return (
    <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <Button variant="ghost" size="icon" className="size-8" onClick={onClear}>
        <X className="size-4" />
      </Button>
      <span className="text-sm font-medium">{count} selected</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {scope === "active" ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={pending}>
                  <Shield className="size-4" /> Visibility
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {VISIBILITY_ORDER.map((key) => {
                  const Item = VISIBILITY[key];
                  return (
                    <DropdownMenuItem
                      key={key}
                      onSelect={() =>
                        run(
                          () => bulkSetVisibility(selectedIds, key),
                          `${count} set to ${Item.label}`,
                        )
                      }
                    >
                      <Item.icon className="size-4" /> {Item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={pending}>
                  <FolderInput className="size-4" /> Move to
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {collections.map((collection) => (
                  <DropdownMenuItem
                    key={collection.id}
                    onSelect={() =>
                      run(
                        () => moveToCollection(selectedIds, collection.id),
                        `Moved to ${collection.name}`,
                      )
                    }
                  >
                    {collection.name}
                  </DropdownMenuItem>
                ))}
                {collections.length > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => moveToCollection(selectedIds, null),
                      "Removed from folder",
                    )
                  }
                >
                  No folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => softDeleteRecordings(selectedIds),
                  `${count} moved to trash`,
                )
              }
            >
              <Trash2 className="size-4" /> Trash
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => restoreRecordings(selectedIds),
                  `${count} restored`,
                )
              }
            >
              <RotateCcw className="size-4" /> Restore
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmingDestroy(true)}
            >
              <Trash2 className="size-4" /> Delete forever
            </Button>
          </>
        )}
      </div>

      <AlertDialog
        open={confirmingDestroy}
        onOpenChange={setConfirmingDestroy}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the videos, thumbnails, and share links.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setConfirmingDestroy(false);
                run(
                  () => deleteRecordingsForever(selectedIds),
                  `${count} deleted permanently`,
                );
              }}
              disabled={pending}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
