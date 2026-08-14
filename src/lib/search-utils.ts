// Mianx.ai — Search & Filter utility for projects, deliverables, tickets

export interface SearchFilter {
  query: string;
  status?: string;
  category?: string;
  sortBy?: "newest" | "oldest" | "name";
}

export function filterAndSort<T extends { id: string; createdAt: string }>(
  items: T[],
  filter: SearchFilter,
  searchableFields: (item: T) => string[],
): T[] {
  let result = [...items];

  // Search query
  if (filter.query.trim()) {
    const query = filter.query.toLowerCase();
    result = result.filter((item) =>
      searchableFields(item).some((field) =>
        field.toLowerCase().includes(query),
      ),
    );
  }

  // Sort
  switch (filter.sortBy) {
    case "oldest":
      result.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      break;
    case "name":
      // Will be overridden by caller if needed
      break;
    case "newest":
    default:
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  return result;
}

// ─────────────────────────────────────────────
//  Debounce hook for search inputs
// ─────────────────────────────────────────────

import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
