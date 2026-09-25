import { z } from "zod";

import Link from "next/link";

import type { ImageDetail } from "@/lib/library/schemas";

import { chip, panel } from "./styles";
import type { RelatedTag } from "./schemas";

const DescriptionPanelPropsSchema = z.object({
  descriptions: z.custom<ImageDetail["descriptions"]>(),
});
type DescriptionPanelProps = z.infer<typeof DescriptionPanelPropsSchema>;

export function DescriptionPanel({ descriptions }: DescriptionPanelProps) {
  return (
    <div className={panel}>
      <h2 className="mb-1 text-ui-sm font-semibold text-ui-ink-title">AI description</h2>
      <div className="flex flex-col gap-2">
        {descriptions.map((d) => (
          <div key={d.id}>
            <p className="whitespace-pre-wrap text-ui-xs text-ui-ink">{d.description}</p>
            {d.provider && (
              <p className="mt-1 text-ui-2xs text-ui-ink-muted">via {d.provider}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const PromptPanelPropsSchema = z.object({
  prompt: z.string().nullable(),
  negativePrompt: z.string().nullable(),
});
type PromptPanelProps = z.infer<typeof PromptPanelPropsSchema>;

export function PromptPanel({ prompt, negativePrompt }: PromptPanelProps) {
  return (
    <div className={panel}>
      {prompt && (
        <>
          <h2 className="mb-1 text-ui-sm font-semibold text-ui-ink-title">Prompt</h2>
          <p className="whitespace-pre-wrap text-ui-xs text-ui-ink">{prompt}</p>
        </>
      )}
      {negativePrompt && (
        <>
          <h2 className={`mb-1 text-ui-sm font-semibold text-ui-ink-title ${prompt ? "mt-3" : ""}`}>
            Negative prompt
          </h2>
          <p className="whitespace-pre-wrap text-ui-xs text-ui-ink-muted">{negativePrompt}</p>
        </>
      )}
    </div>
  );
}

const TagsPanelPropsSchema = z.object({
  tags: z.custom<ImageDetail["tags"]>(),
});
type TagsPanelProps = z.infer<typeof TagsPanelPropsSchema>;

export function TagsPanel({ tags }: TagsPanelProps) {
  return (
    <div className={panel}>
      <h2 className="mb-2 text-ui-sm font-semibold text-ui-ink-title">Tags</h2>
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <Link
            key={`${t.normalizedName}-${t.source}`}
            href={`/library?tags=${encodeURIComponent(t.normalizedName || t.name)}`}
            prefetch={false}
            className={`${chip} transition hover:text-accent-cyan`}
            data-testid={`image-detail-tag-link-${t.normalizedName}-${t.source}`}
          >
            {t.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

const RelatedTagsPanelPropsSchema = z.object({
  relatedTags: z.array(z.custom<RelatedTag>()),
});
type RelatedTagsPanelProps = z.infer<typeof RelatedTagsPanelPropsSchema>;

export function RelatedTagsPanel({ relatedTags }: RelatedTagsPanelProps) {
  return (
    <div className={panel}>
      <h2 className="mb-2 text-ui-sm font-semibold text-ui-ink-title">Related tags</h2>
      <div className="flex flex-wrap gap-1">
        {relatedTags.map((t) => (
          <Link
            key={t.name}
            href={`/library?tags=${encodeURIComponent(t.name)}`}
            prefetch={false}
            className="flex items-center gap-1 rounded-full bg-ui-bg px-2 py-0.5 text-ui-2xs text-ui-ink-muted transition hover:text-accent-cyan"
            title={`${t.coOccurrence} images also tagged ${t.name}`}
            data-testid={`image-detail-related-tag-link-${t.name}`}
          >
            {t.name}
            <span className="text-ui-ink-muted/60">{t.coOccurrence}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const LorasPanelPropsSchema = z.object({
  loras: z.custom<ImageDetail["loras"]>(),
});
type LorasPanelProps = z.infer<typeof LorasPanelPropsSchema>;

export function LorasPanel({ loras }: LorasPanelProps) {
  return (
    <div className={panel}>
      <h2 className="mb-2 text-ui-sm font-semibold text-ui-ink-title">LoRAs</h2>
      <ul className="text-ui-xs text-ui-ink">
        {loras.map((l) => (
          <li key={l.name}>{l.name} {l.weight != null ? `(${l.weight})` : ""}</li>
        ))}
      </ul>
    </div>
  );
}

const GenerationParamsPanelPropsSchema = z.object({
  generationParams: z.custom<NonNullable<ImageDetail["generationParams"]>>(),
});
type GenerationParamsPanelProps = z.infer<typeof GenerationParamsPanelPropsSchema>;

export function GenerationParamsPanel({ generationParams }: GenerationParamsPanelProps) {
  return (
    <div className={panel}>
      <h2 className="mb-2 text-ui-sm font-semibold text-ui-ink-title">Generation</h2>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-ui-xs text-ui-ink-muted">
        {Object.entries(generationParams)
          .filter(([, v]) => v != null)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="break-words">{k}</dt>
              <dd className="break-words text-ui-ink">{String(v)}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
