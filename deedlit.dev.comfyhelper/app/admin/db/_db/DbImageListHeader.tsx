import { z } from "zod";

const DbImageListHeaderPropsSchema = z.object({
  count: z.number(),
  hasMore: z.boolean(),
  pickedCount: z.number(),
  onClearPicked: z.custom<() => void>(),
  onPickAllLoaded: z.custom<() => void>(),
});
type DbImageListHeaderProps = z.infer<typeof DbImageListHeaderPropsSchema>;

export function DbImageListHeader({ count, hasMore, pickedCount, onClearPicked, onPickAllLoaded }: DbImageListHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-ui-sm font-semibold text-ui-ink-title">
        Images{" "}
        <span className="text-ui-2xs text-ui-ink-muted">
          ({count}
          {hasMore ? "+" : ""})
        </span>
      </h2>
      <button
        className="text-ui-2xs text-ui-ink-muted transition hover:text-accent-cyan"
        onClick={pickedCount > 0 ? onClearPicked : onPickAllLoaded}
        data-testid="db-pick-toggle"
      >
        {pickedCount > 0 ? "Clear selection" : "Select all loaded"}
      </button>
    </div>
  );
}
