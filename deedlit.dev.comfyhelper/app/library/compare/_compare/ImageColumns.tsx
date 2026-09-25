import Link from "next/link";
import { z } from "zod";

import type { CompareImage } from "@/lib/library/schemas";

import { gridCols } from "./styles";

const ImageColumnsPropsSchema = z.object({
  images: z.array(z.custom<CompareImage>()),
  n: z.number(),
  onRemove: z.custom<(id: string) => void>(),
});
type ImageColumnsProps = z.infer<typeof ImageColumnsPropsSchema>;

/** One column per compared image: thumbnail, filename, and a remove button. */
export function ImageColumns({ images, n, onRemove }: ImageColumnsProps) {
  return (
    <div className="grid gap-3" style={gridCols(n)}>
      {images.map((img) => (
        <div key={img.id} className="flex flex-col gap-2">
          <Link
            href={`/library/${img.id}`}
            prefetch={false}
            className="overflow-hidden rounded-xl border border-ui-border/60 hover:border-accent-cyan"
            data-testid={`compare-image-link-${img.id}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.imageUrl}
              alt={img.filename}
              className="aspect-square w-full bg-ui-bg object-contain"
            />
          </Link>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-ui-xs text-ui-ink" title={img.filename}>
              {img.filename}
            </span>
            <button
              onClick={() => onRemove(img.id)}
              className="shrink-0 text-ui-2xs text-ui-ink-muted hover:text-rose-500"
              data-testid={`compare-remove-image-${img.id}`}
            >
              remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
