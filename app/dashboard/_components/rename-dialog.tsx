"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { renameRecording } from "../_actions";

type Props = {
  id: string;
  currentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RenameDialog({ id, currentTitle, open, onOpenChange }: Props) {
  const [title, setTitle] = useState(currentTitle);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await renameRecording(id, title);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Renamed");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename recording</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rename">Title</Label>
          <Input
            id="rename"
            value={title}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
