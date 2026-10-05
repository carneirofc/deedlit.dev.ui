import { z } from "zod";

import type { CatalogImage } from "./schemas";

const DbImageRowPropsSchema = z.object({
  image: z.custom<CatalogImage>(),
  isSelected: z.boolean(),
  isPicked: z.boolean(),
  onTogglePick: z.custom<(sha256: string) => void>(),
  onSelect: z.custom<(image: CatalogImage) => void>(),
});
type DbImageRowProps = z.infer<typeof DbImageRowPropsSchema>;

export function DbImageRow({ image, isSelected, isPicked, onTogglePick, onSelect }: DbImageRowProps) {
  return (
    <div
      className={`flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
        isSelected
          ? "border-accent-cyan bg-accent-cyan/10"
          : isPicked
            ? "border-rose-500/40 bg-rose-500/5"
            : "border-ui-border/50 bg-ui-bg hover:bg-ui-bg-soft"
      }`}
      data-testid={`db-row-${image.sha256}`}
    >
      <input
        type="checkbox"
        checked={isPicked}
        onChange={() => onTogglePick(image.sha256)}
        aria-label={`Select ${image.sha256}`}
        className="ml-1 shrink-0"
        data-testid={`db-pick-${image.sha256}`}
      />
      <button
        onClick={() => onSelect(image)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-ui-xs"
        data-testid={`db-open-${image.sha256}`}
      >
        <img
          src={`/api/library/images/${image.sha256}/thumbnail`}
          alt=""
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-md border border-ui-border/50 bg-ui-bg-soft object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {image.safety && (
              <span className="shrink-0 rounded-full bg-ui-bg-soft px-1.5 py-0.5 text-ui-2xs text-ui-ink-muted">
                {image.safety}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-ui-ink">
              {image.prompt || image.sha256.slice(0, 16)}
            </span>
            {image.favorite && <span className="shrink-0 text-amber-500">★</span>}
          </div>
          <div className="mt-0.5 truncate font-mono text-ui-2xs text-ui-ink-muted">{image.sha256}</div>
        </div>
      </button>
    </div>
  );
}
