"use client";

import Link from "next/link";
import { z } from "zod";

import type { ImageDetail } from "./schemas";

const DetailSectionPropsSchema = z.object({
  detail: z.custom<ImageDetail>(),
});
type DetailSectionProps = z.infer<typeof DetailSectionPropsSchema>;

const LightboxDetailPanelPropsSchema = DetailSectionPropsSchema.extend({
  imageId: z.string(),
});
type LightboxDetailPanelProps = z.infer<typeof LightboxDetailPanelPropsSchema>;

const sec = "border-t border-ui-border/40 pt-3 mt-3";
const label = "text-ui-2xs font-medium uppercase tracking-wide text-ui-ink-muted mb-1";

function DetailMetaGrid({ detail }: DetailSectionProps) {
  return (
    <dl className={`${sec} grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-ui-ink-muted`}>
      {detail.model && <><dt>Model</dt><dd className="break-words text-ui-ink">{detail.model}</dd></>}
      {detail.modelFamily && <><dt>Family</dt><dd className="break-words text-ui-ink">{detail.modelFamily}</dd></>}
      {detail.checkpoint && <><dt>Checkpoint</dt><dd className="break-words text-ui-ink">{detail.checkpoint}</dd></>}
      {detail.sourceTool && <><dt>Source</dt><dd className="break-words text-ui-ink">{detail.sourceTool}</dd></>}
      {(detail.width || detail.height) && <><dt>Size</dt><dd className="text-ui-ink">{detail.width}×{detail.height}</dd></>}
    </dl>
  );
}

function DetailTags({ detail }: DetailSectionProps) {
  if (detail.tags.length === 0) return null;
  return (
    <div className={sec}>
      <p className={label}>Tags</p>
      <div className="flex flex-wrap gap-1">
        {detail.tags.map((t) => (
          <Link
            key={`${t.normalizedName}-${t.source}`}
            href={`/library?tags=${encodeURIComponent(t.normalizedName || t.name)}`}
            prefetch={false}
            className="rounded-full bg-ui-bg px-2 py-0.5 text-ui-2xs text-ui-ink-muted transition hover:text-accent-cyan"
            data-testid={`lightbox-detail-tag-${t.normalizedName}`}
          >
            {t.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

function DetailLoras({ detail }: DetailSectionProps) {
  if (detail.loras.length === 0) return null;
  return (
    <div className={sec}>
      <p className={label}>LoRAs</p>
      <ul className="flex flex-col gap-0.5">
        {detail.loras.map((l) => (
          <li key={l.name} className="text-ui-2xs text-ui-ink-muted">
            {l.name}{l.weight != null ? ` (${l.weight})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailDescriptions({ detail }: DetailSectionProps) {
  if (detail.descriptions.length === 0) return null;
  return (
    <div className={sec}>
      <p className={label}>AI description</p>
      {detail.descriptions.map((d) => (
        <p key={d.id} className="line-clamp-4 text-ui-2xs text-ui-ink">{d.description}</p>
      ))}
    </div>
  );
}

export function LightboxDetailPanel({ detail, imageId }: LightboxDetailPanelProps) {
  return (
    <div className="flex flex-col text-ui-xs text-ui-ink">
      <p className="break-all font-medium text-ui-ink-title">{detail.filename}</p>

      <DetailMetaGrid detail={detail} />

      {detail.filePath && (
        <div className={sec}>
          <p className={label}>File path</p>
          <p className="break-all font-mono text-ui-2xs text-ui-ink-muted">{detail.filePath}</p>
        </div>
      )}

      <DetailTags detail={detail} />

      {detail.prompt && (
        <div className={sec}>
          <p className={label}>Prompt</p>
          <p className="line-clamp-6 whitespace-pre-wrap text-ui-2xs text-ui-ink">{detail.prompt}</p>
        </div>
      )}

      {detail.negativePrompt && (
        <div className={sec}>
          <p className={label}>Negative prompt</p>
          <p className="line-clamp-4 whitespace-pre-wrap text-ui-2xs text-ui-ink-muted">{detail.negativePrompt}</p>
        </div>
      )}

      <DetailLoras detail={detail} />
      <DetailDescriptions detail={detail} />

      <div className={sec}>
        <Link
          href={`/library/${imageId}`}
          prefetch={false}
          className="inline-flex items-center gap-1 text-ui-2xs text-accent-cyan hover:underline"
          data-testid="lightbox-detail-open-full-page"
        >
          Open full details
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
