"use client";

import { z } from "zod";

import { CompactResultSchema } from "@/lib/library/schemas";

import { SAFETY_LABEL } from "./constants-safety";

const StarRatingPropsSchema = z.object({ value: z.number() });
type StarRatingProps = z.infer<typeof StarRatingPropsSchema>;

export function StarRating({ value }: StarRatingProps) {
  return (
    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-ui-2xs text-amber-500">
      {"★".repeat(Math.min(5, value))}
    </span>
  );
}

const CardMetaPropsSchema = z.object({
  r: CompactResultSchema,
  showScores: z.boolean(),
});
type CardMetaProps = z.infer<typeof CardMetaPropsSchema>;

export function CardMeta({ r, showScores }: CardMetaProps) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {showScores && typeof r.score === "number" && r.score > 0 && (
        <span className="rounded bg-accent-cyan/15 px-1.5 py-0.5 text-ui-2xs text-accent-cyan">{r.score.toFixed(3)}</span>
      )}
      {r.rating && r.rating > 0 && <StarRating value={r.rating} />}
      {(r.safety === "nsfw" || r.safety === "explicit") && (
        <span
          className={`rounded px-1.5 py-0.5 text-ui-2xs font-medium ${
            r.safety === "explicit" ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-500"
          }`}
        >
          {SAFETY_LABEL[r.safety]}
        </span>
      )}
      {r.model && <span className="rounded bg-ui-bg px-1.5 py-0.5 text-ui-2xs text-ui-ink-muted">{r.model}</span>}
    </div>
  );
}
