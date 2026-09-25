import { z } from "zod";

import type { CompareImage } from "@/lib/library/schemas";

import { gridCols, panel } from "./styles";

const TagsSectionPropsSchema = z.object({
  images: z.array(z.custom<CompareImage>()),
  n: z.number(),
  sharedTags: z.array(z.string()),
  uniqueTags: z.array(z.array(z.string())),
});
type TagsSectionProps = z.infer<typeof TagsSectionPropsSchema>;

/** Shared-tags summary plus a per-image column of tags unique to that image. */
export function TagsSection({ images, n, sharedTags, uniqueTags }: TagsSectionProps) {
  return (
    <section className={panel}>
      <h2 className="mb-2 text-ui-sm font-semibold text-ui-ink-title">Tags</h2>
      {sharedTags.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-ui-2xs uppercase tracking-wide text-ui-ink-muted">Shared</p>
          <div className="flex flex-wrap gap-1">
            {sharedTags.map((t) => (
              <span key={t} className="rounded-full bg-accent-cyan/15 px-2 py-0.5 text-ui-2xs text-accent-cyan">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3" style={gridCols(n)}>
        {images.map((img, i) => (
          <div key={img.id}>
            <p className="mb-1 text-ui-2xs uppercase tracking-wide text-ui-ink-muted">
              Only in {img.filename.slice(0, 14)}…
            </p>
            <div className="flex flex-wrap gap-1">
              {(uniqueTags[i] ?? []).length === 0 ? (
                <span className="text-ui-2xs text-ui-ink-muted">—</span>
              ) : (
                uniqueTags[i].map((t) => (
                  <span key={t} className="rounded-full bg-ui-bg px-2 py-0.5 text-ui-2xs text-ui-ink-muted">
                    {t}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
