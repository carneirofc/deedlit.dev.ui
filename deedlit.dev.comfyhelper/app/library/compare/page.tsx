"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";

import { CompareResults } from "./_compare/CompareResults";
import { useCompareData } from "./_compare/useCompareData";
import { useCompareTray } from "@/lib/store/compare-tray";

function ComparePageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tray = useCompareTray();
  const idsParam = params.get("ids") ?? "";
  const { ids, data, error, loading } = useCompareData(idsParam);

  const removeImage = useCallback(
    (id: string) => {
      tray.remove(id);
      const next = ids.filter((x) => x !== id);
      router.replace(`/library/compare?ids=${next.join(",")}`);
    },
    [tray, ids, router],
  );

  const n = data?.images.length ?? ids.length;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-ui-2xl font-semibold text-ui-ink-title">Compare images</h1>
          <p className="text-ui-sm text-ui-ink-muted">
            Side-by-side metadata diff, shared tags, and embedding similarity.
          </p>
        </div>
        <Link href="/library" prefetch={false} className="text-ui-sm text-accent-cyan">
          ← Back to library
        </Link>
      </header>

      {ids.length < 2 && (
        <p className="text-ui-sm text-ui-ink-muted">
          Pick at least two images (use the “Compare” button on cards) to compare them.
        </p>
      )}
      {error && <p className="text-ui-sm text-rose-500">{error}</p>}
      {loading && !data && <p className="text-ui-sm text-ui-ink-muted">Loading…</p>}

      {data && data.images.length >= 2 && (
        <CompareResults
          data={data}
          n={n}
          onRemove={removeImage}
          onGraphNodeClick={(id, type) => {
            if (type === "Image") router.push(`/library/${id}`);
          }}
        />
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="text-ui-sm text-ui-ink-muted">Loading…</p>}>
      <ComparePageInner />
    </Suspense>
  );
}
