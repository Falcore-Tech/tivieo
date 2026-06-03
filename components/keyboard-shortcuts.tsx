"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: "N", label: "New recording" },
  { keys: "/", label: "Search your library" },
  { keys: "?", label: "Show this help" },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "n") {
        event.preventDefault();
        router.push("/record");
      } else if (event.key === "/") {
        event.preventDefault();
        document.getElementById("library-search")?.focus();
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="grid gap-2">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.keys}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{shortcut.label}</span>
              <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">
                {shortcut.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
