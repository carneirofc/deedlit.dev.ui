import { z } from "zod";

import Link from "next/link";

import type { ImageDetail } from "@/lib/library/schemas";
import type { LibrarySettings } from "@/lib/store/settings";

import { DetailColumns } from "./DetailColumns";
import { ImageViewer } from "./ImageViewer";
import type { RelatedTag } from "./schemas";

const DetailHeaderPropsSchema = z.object({
  detail: z.custom<ImageDetail>(),
  settings: z.custom<LibrarySettings>(),
  viewerSrc: z.string(),
  onToggleFullResolution: z.custom<() => void>(),
  relatedTags: z.array(z.custom<RelatedTag>()),
  ratingBusy: z.boolean(),
  onRate: z.custom<(rating: number | null) => void>(),
  onToggleFavorite: z.custom<() => void>(),
  pathCopied: z.boolean(),
  onCopyPath: z.custom<() => void>(),
  confirmingDelete: z.boolean(),
  setConfirmingDelete: z.custom<(v: boolean) => void>(),
  deleting: z.boolean(),
  onRemove: z.custom<() => void>(),
});
type DetailHeaderProps = z.infer<typeof DetailHeaderPropsSchema>;

/** Back link, the main image viewer, and the metadata columns. */
export function DetailHeader({
  detail,
  settings,
  viewerSrc,
  onToggleFullResolution,
  relatedTags,
  ratingBusy,
  onRate,
  onToggleFavorite,
  pathCopied,
  onCopyPath,
  confirmingDelete,
  setConfirmingDelete,
  deleting,
  onRemove,
}: DetailHeaderProps) {
  return (
    <>
      <Link href="/library" prefetch={false} className="text-ui-sm text-accent-cyan">
        ← Back to library
      </Link>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <ImageViewer
          src={viewerSrc}
          alt={detail.filename}
          fullResolution={settings.viewerFullResolution}
          imageFit={settings.viewerImageFit}
          onToggleFullResolution={onToggleFullResolution}
        />

        <DetailColumns
          detail={detail}
          settings={settings}
          relatedTags={relatedTags}
          ratingBusy={ratingBusy}
          onRate={onRate}
          onToggleFavorite={onToggleFavorite}
          pathCopied={pathCopied}
          onCopyPath={onCopyPath}
          confirmingDelete={confirmingDelete}
          setConfirmingDelete={setConfirmingDelete}
          deleting={deleting}
          onRemove={onRemove}
        />
      </div>
    </>
  );
}
