import { useCallback, useEffect, useState } from "react";

import { CompareResultSchema, type CompareResult } from "@/lib/library/schemas";

/** Parses the comma-separated `ids` search param into a clean id list. */
export function parseCompareIds(idsParam: string): string[] {
  return idsParam.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Loads the compare result for the given ids param, refetching whenever it
 * changes. Requires at least two ids — otherwise clears the data. */
export function useCompareData(idsParam: string) {
  const ids = parseCompareIds(idsParam);
  const [data, setData] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (imageIds: string[]) => {
    if (imageIds.length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/library/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageIds }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Compare failed");
      setData(CompareResultSchema.parse(j));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(ids);
  }, [idsParam]);

  return { ids, data, error, loading };
}
