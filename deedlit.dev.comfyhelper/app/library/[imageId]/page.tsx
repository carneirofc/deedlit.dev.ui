"use client";
import { z } from "zod";

import { useParams } from "next/navigation";

import { useActivity } from "@/lib/store/activity";
import { useSettings } from "@/lib/store/settings";

import { DetailHeader } from "./_detail/DetailHeader";
import { DetailSections } from "./_detail/DetailSections";
import {
  useImageDetail,
  useImageNotes,
  useRelatedTags,
  useRelationshipGraph,
  useSimilarImages,
} from "./_detail/useDetailData";
import {
  useCopyPath,
  useRateImage,
  useRemoveFromLibrary,
  useToggleFavorite,
  useVectorDebug,
} from "./_detail/useDetailActions";
import { useImageDetailSuggestRequested } from "./_detail/useSuggestRequested";

const ImageIdParamsSchema = z.object({ imageId: z.string() });
type ImageIdParams = z.infer<typeof ImageIdParamsSchema>;

export default function ImageDetailPage() {
  const params = useParams<ImageIdParams>();
  const imageId = params.imageId;
  const { settings, setKey, hydrated } = useSettings();
  const { track } = useActivity();

  const { detail, setDetail, error } = useImageDetail(imageId);
  const suggestRequested = useImageDetailSuggestRequested(imageId, hydrated, settings.autoLoadSuggestions);
  const { similar, suggestLoading } = useSimilarImages(imageId, hydrated, settings, suggestRequested.value);
  const graph = useRelationshipGraph(imageId, hydrated, settings);
  const relatedTags = useRelatedTags(detail, hydrated, settings);
  const notesState = useImageNotes(imageId);

  const { rateImage, ratingBusy } = useRateImage(imageId, detail, setDetail);
  const toggleFavorite = useToggleFavorite(imageId, detail, setDetail, track);
  const removal = useRemoveFromLibrary(imageId, track);
  const debugState = useVectorDebug(imageId);
  const { pathCopied, copyPath } = useCopyPath(detail?.filePath);

  if (error) return <p className="text-rose-500">{error}</p>;
  if (!detail) return <p className="text-ui-ink-muted">Loading…</p>;

  const viewerSrc = settings.viewerFullResolution
    ? `/api/library/images/${imageId}/file`
    : `/api/library/images/${imageId}/thumbnail`;

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <DetailHeader
        detail={detail}
        settings={settings}
        viewerSrc={viewerSrc}
        onToggleFullResolution={() => setKey("viewerFullResolution", !settings.viewerFullResolution)}
        relatedTags={relatedTags}
        ratingBusy={ratingBusy}
        onRate={rateImage}
        onToggleFavorite={toggleFavorite}
        pathCopied={pathCopied}
        onCopyPath={copyPath}
        confirmingDelete={removal.confirmingDelete}
        setConfirmingDelete={removal.setConfirmingDelete}
        deleting={removal.deleting}
        onRemove={removal.removeFromLibrary}
      />

      <DetailSections
        showSimilar={settings.showSimilar}
        similar={similar}
        suggestLoading={suggestLoading}
        suggestRequested={suggestRequested.value}
        onLoadSuggestions={() => suggestRequested.setValue(true)}
        debugState={debugState}
        notesState={notesState}
        showRelationshipGraph={settings.showRelationshipGraph}
        graph={graph}
      />
    </div>
  );
}
