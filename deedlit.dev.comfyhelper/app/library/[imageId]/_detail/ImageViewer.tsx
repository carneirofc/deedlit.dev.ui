import { z } from "zod";

const ImageViewerPropsSchema = z.object({
  src: z.string(),
  alt: z.string(),
  fullResolution: z.boolean(),
  imageFit: z.enum(["contain", "cover"]),
  onToggleFullResolution: z.custom<() => void>(),
});
type ImageViewerProps = z.infer<typeof ImageViewerPropsSchema>;

/** Main detail-page viewer: the image plus the HD/thumbnail quality toggle. */
export function ImageViewer({ src, alt, fullResolution, imageFit, onToggleFullResolution }: ImageViewerProps) {
  const viewerClass =
    imageFit === "cover"
      ? "h-[80vh] w-full bg-ui-bg object-cover"
      : "max-h-[80vh] w-full bg-ui-bg object-contain";

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-ui-border/60 xl:w-[55%] xl:max-w-[1400px]">
      {/* Quality indicator + quick toggle: HD original vs cached thumbnail. */}
      <button
        type="button"
        onClick={onToggleFullResolution}
        aria-pressed={fullResolution}
        title="Toggle full-resolution original"
        data-testid="image-detail-quality-toggle"
        className={`absolute left-2 top-2 z-10 rounded-md border px-2 py-1 text-ui-2xs font-semibold backdrop-blur transition ${
          fullResolution
            ? "border-accent-cyan bg-ui-bg/80 text-accent-cyan"
            : "border-ui-border/60 bg-ui-bg/80 text-ui-ink-muted hover:text-ui-ink"
        }`}
      >
        {fullResolution ? "HD · original" : "Thumbnail"}
      </button>
      <img src={src} alt={alt} className={viewerClass} />
    </div>
  );
}
