"use client";

import { z } from "zod";

import { Lightbox, type LightboxItem } from "@/app/library/components/Lightbox";
import type { CompactResult } from "@/lib/library/schemas";
import type { LibrarySettings } from "@/lib/store/settings";

import type { LibraryNote } from "./schemas";

const LibraryLightboxPropsSchema = z.object({
  lightboxIndex: z.number().nullable(),
  autoPlay: z.boolean(),
  galleryItems: z.array(z.custom<CompactResult>()),
  settings: z.custom<LibrarySettings>(),
  hasMore: z.boolean(),
  loading: z.boolean(),
  onLoadMore: z.custom<() => void>(),
  onClose: z.custom<() => void>(),
  onCurrentChange: z.custom<(item: Pick<CompactResult, "imageId"> | null) => void>(),
  onSimilar: z.custom<(item: LightboxItem) => void>(),
  onToggleFullResolution: z.custom<() => void>(),
  onRating: z.custom<(imageId: string, rating: number | null) => void>(),
  fetchNotes: z.custom<(imageId: string) => Promise<LibraryNote[]>>(),
  onCreateNote: z.custom<(imageId: string, text: string) => Promise<void>>(),
  onDelete: z.custom<(imageId: string) => Promise<void>>(),
});
type LibraryLightboxProps = z.infer<typeof LibraryLightboxPropsSchema>;

/** The fullscreen viewer / slideshow, mounted only while an item is open and
 * still present in the current gallery window. */
export function LibraryLightbox(props: LibraryLightboxProps) {
  const { lightboxIndex, galleryItems } = props;
  if (lightboxIndex === null || !galleryItems[lightboxIndex]) return null;

  return (
    <Lightbox
      items={galleryItems}
      initialIndex={lightboxIndex}
      fullResolution={props.settings.viewerFullResolution}
      slideshow={{
        interval: props.settings.slideshowInterval,
        loop: props.settings.slideshowLoop,
        shuffle: props.settings.slideshowShuffle,
      }}
      autoPlay={props.autoPlay}
      hasMore={props.hasMore}
      loadingMore={props.loading}
      onLoadMore={props.onLoadMore}
      onCurrentChange={props.onCurrentChange}
      onClose={props.onClose}
      onSimilar={(it) => {
        props.onClose();
        props.onSimilar(it);
      }}
      onToggleFullResolution={props.onToggleFullResolution}
      onRating={props.onRating}
      fetchNotes={props.fetchNotes}
      onCreateNote={props.onCreateNote}
      onDelete={props.onDelete}
    />
  );
}
