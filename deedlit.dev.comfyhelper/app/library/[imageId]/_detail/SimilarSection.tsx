import { z } from "zod";

import Link from "next/link";

import type { CompactResult } from "@/lib/library/schemas";

const SimilarSectionPropsSchema = z.object({
  similar: z.array(z.custom<CompactResult>()),
  suggestLoading: z.boolean(),
  suggestRequested: z.boolean(),
  onLoadSuggestions: z.custom<() => void>(),
  debugOpen: z.boolean(),
  onToggleDebug: z.custom<() => void>(),
});
type SimilarSectionProps = z.infer<typeof SimilarSectionPropsSchema>;

/** "Similar images" grid, its load-on-demand button, and the vector-debug
 * toggle. */
export function SimilarSection({
  similar,
  suggestLoading,
  suggestRequested,
  onLoadSuggestions,
  debugOpen,
  onToggleDebug,
}: SimilarSectionProps) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-ui-lg font-semibold text-ui-ink-title">Similar images</h2>
        <div className="flex items-center gap-3">
          {suggestLoading && <span className="text-ui-xs text-ui-ink-muted">Loading…</span>}
          <button
            onClick={onToggleDebug}
            className="rounded-lg border border-ui-border/60 px-2 py-1 text-ui-xs text-ui-ink-muted hover:border-accent-cyan hover:text-accent-cyan"
            data-testid="image-detail-vector-debug-toggle"
          >
            {debugOpen ? "Hide" : "Show"} vector debug
          </button>
        </div>
      </div>
      {!suggestRequested ? (
        <button
          onClick={onLoadSuggestions}
          className="rounded-lg border border-ui-border/70 bg-ui-bg-soft px-3 py-2 text-ui-sm font-medium transition hover:bg-accent-cyan/10"
          data-testid="image-detail-load-similar"
        >
          Load similar images
        </button>
      ) : similar.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 4xl:grid-cols-12 5xl:grid-cols-14">
          {similar.map((s) => (
            <Link
              key={s.imageId}
              href={`/library/${s.imageId}`}
              prefetch={false}
              className="group relative overflow-hidden rounded-lg border border-ui-border/60 hover:border-accent-cyan"
              data-testid={`image-detail-similar-link-${s.imageId}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.thumbnailUrl} alt={s.summary} loading="lazy" className="aspect-square w-full object-cover" />
              {s.score != null && (
                <span className="absolute bottom-1 right-1 rounded bg-ui-bg/85 px-1.5 py-0.5 text-ui-2xs font-mono text-accent-cyan">
                  {s.score.toFixed(3)}
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        !suggestLoading && (
          <p className="text-ui-sm text-ui-ink-muted">No similar images found.</p>
        )
      )}
    </section>
  );
}
