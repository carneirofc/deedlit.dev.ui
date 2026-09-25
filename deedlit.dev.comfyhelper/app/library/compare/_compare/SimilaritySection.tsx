import { z } from "zod";

import type { CompareImage, PairwiseSimilarity } from "@/lib/library/schemas";

import { panel } from "./styles";

const SimilaritySectionPropsSchema = z.object({
  images: z.array(z.custom<CompareImage>()),
  similarityAvailable: z.boolean(),
  pairwiseSimilarity: z.array(z.custom<PairwiseSimilarity>()),
});
type SimilaritySectionProps = z.infer<typeof SimilaritySectionPropsSchema>;

function score(pairwiseSimilarity: PairwiseSimilarity[], a: string, b: string): number | null {
  const hit = pairwiseSimilarity.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
  return hit ? hit.score : null;
}

/** Pairwise embedding-similarity chips for every combination of compared
 * images, or a fallback note when no embeddings are indexed. */
export function SimilaritySection({ images, similarityAvailable, pairwiseSimilarity }: SimilaritySectionProps) {
  return (
    <section className={panel}>
      <h2 className="mb-2 text-ui-sm font-semibold text-ui-ink-title">Embedding similarity</h2>
      {similarityAvailable ? (
        <div className="flex flex-wrap gap-2">
          {images.flatMap((a, i) =>
            images.slice(i + 1).map((b) => {
              const s = score(pairwiseSimilarity, a.id, b.id);
              return (
                <span
                  key={`${a.id}-${b.id}`}
                  className="flex items-center gap-1.5 rounded-lg border border-ui-border/60 px-2 py-1 text-ui-xs"
                >
                  <span className="text-ui-ink-muted">{a.filename.slice(0, 10)}…</span>
                  <span className="text-ui-ink-muted">↔</span>
                  <span className="text-ui-ink-muted">{b.filename.slice(0, 10)}…</span>
                  <span className="rounded bg-accent-cyan/15 px-1.5 py-0.5 text-accent-cyan">
                    {s != null ? s.toFixed(3) : "—"}
                  </span>
                </span>
              );
            }),
          )}
        </div>
      ) : (
        <p className="text-ui-xs text-ui-ink-muted">
          No embeddings indexed for these images (rebuild Qdrant to enable similarity).
        </p>
      )}
    </section>
  );
}
