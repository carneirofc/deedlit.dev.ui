import { z } from "zod";

import type { ImageDetail } from "@/lib/library/schemas";
import type { LibrarySettings } from "@/lib/store/settings";

import { InfoPanel } from "./InfoPanel";
import {
  DescriptionPanel,
  GenerationParamsPanel,
  LorasPanel,
  PromptPanel,
  RelatedTagsPanel,
  TagsPanel,
} from "./MetaPanels";
import type { RelatedTag } from "./schemas";

const DetailTextPanelsPropsSchema = z.object({
  detail: z.custom<ImageDetail>(),
  settings: z.custom<LibrarySettings>(),
});
type DetailTextPanelsProps = z.infer<typeof DetailTextPanelsPropsSchema>;

/** Description and prompt panels — the free-text metadata. */
function DetailTextPanels({ detail, settings }: DetailTextPanelsProps) {
  return (
    <>
      {settings.showDescription && detail.descriptions.length > 0 && (
        <DescriptionPanel descriptions={detail.descriptions} />
      )}

      {settings.showPrompt && (detail.prompt || detail.negativePrompt) && (
        <PromptPanel prompt={detail.prompt} negativePrompt={detail.negativePrompt} />
      )}
    </>
  );
}

const DetailMetaPanelsPropsSchema = z.object({
  detail: z.custom<ImageDetail>(),
  settings: z.custom<LibrarySettings>(),
  relatedTags: z.array(z.custom<RelatedTag>()),
});
type DetailMetaPanelsProps = z.infer<typeof DetailMetaPanelsPropsSchema>;

/** The settings-gated metadata panels shown below the info panel. */
function DetailMetaPanels({ detail, settings, relatedTags }: DetailMetaPanelsProps) {
  return (
    <>
      <DetailTextPanels detail={detail} settings={settings} />

      {detail.tags.length > 0 && <TagsPanel tags={detail.tags} />}

      {settings.showRelatedTags && relatedTags.length > 0 && (
        <RelatedTagsPanel relatedTags={relatedTags} />
      )}

      {detail.loras.length > 0 && <LorasPanel loras={detail.loras} />}

      {settings.showGenerationParams && detail.generationParams && (
        <GenerationParamsPanel generationParams={detail.generationParams} />
      )}
    </>
  );
}

const DetailColumnsPropsSchema = z.object({
  detail: z.custom<ImageDetail>(),
  settings: z.custom<LibrarySettings>(),
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
type DetailColumnsProps = z.infer<typeof DetailColumnsPropsSchema>;

/** Column-width metadata panels: browser fits as many ≥24rem columns as the
 * available space allows, so text never cramps and extra desktop width just
 * adds columns. */
export function DetailColumns({
  detail,
  settings,
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
}: DetailColumnsProps) {
  return (
    <div className="min-w-0 flex-1 columns-[24rem] gap-4 [&>div]:mb-4 [&>div]:break-inside-avoid">
      <InfoPanel
        detail={detail}
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
      <DetailMetaPanels detail={detail} settings={settings} relatedTags={relatedTags} />
    </div>
  );
}
