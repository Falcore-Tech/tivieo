"use client";

import { useSyncExternalStore } from "react";
import type { ViewMode } from "./library-toolbar";

const KEY = "tivieo:view";
const EVENT = "tivieo:view-change";

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): ViewMode {
  return window.localStorage.getItem(KEY) === "list" ? "list" : "grid";
}

function getServerSnapshot(): ViewMode {
  return "grid";
}

export function useStoredView(): [ViewMode, (view: ViewMode) => void] {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setView = (next: ViewMode) => {
    window.localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [view, setView];
}
