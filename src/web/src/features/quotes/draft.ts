import { useSyncExternalStore } from "react";
import {
  PROJECT_TYPES,
  projectType,
  type ProjectTypeId,
  type Size,
} from "./projectTypes";

export type Sizes = Partial<Record<ProjectTypeId, Size>>;
export type Draft = {
  type: ProjectTypeId;
  sizes: Sizes;
  description: string;
};

// Shared by the homepage card and the builder. Project choices survive an
// accidental close for this visit; contact details are never stored.
const KEY = "dc.quote-draft";
const EMPTY: Draft = {
  type: "Boundary wall",
  sizes: {},
  description: "",
};
const listeners = new Set<() => void>();
let current: Draft | undefined;

function clean(value: unknown): Draft {
  const raw = (value ?? {}) as Partial<Draft>;
  const sizes: Sizes = {};
  for (const type of PROJECT_TYPES) {
    const size = raw.sizes?.[type.id];
    if (
      type.length &&
      Number.isFinite(size?.length) &&
      Number.isFinite(size?.width)
    )
      sizes[type.id] = { length: size!.length, width: size!.width };
  }
  return {
    type: projectType(raw.type)?.id ?? EMPTY.type,
    sizes,
    description: typeof raw.description === "string" ? raw.description : "",
  };
}

export function readDraft(): Draft {
  if (!current) {
    try {
      current = clean(JSON.parse(sessionStorage.getItem(KEY) ?? "null"));
    } catch {
      current = EMPTY;
    }
  }
  return current;
}

export function updateDraft(change: Partial<Draft> | null) {
  current = change ? { ...readDraft(), ...change } : EMPTY;
  try {
    if (change) sessionStorage.setItem(KEY, JSON.stringify(current));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* Storage can be unavailable; choices then last until the page reloads. */
  }
  listeners.forEach((listener) => listener());
}

export function useDraft() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, readDraft);
}
