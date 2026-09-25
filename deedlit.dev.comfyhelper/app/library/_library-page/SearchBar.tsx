"use client";

import { z } from "zod";

import { cls } from "./constants";
import { ImageDropzone } from "./ImageDropzone";
import { SimilarRefSchema } from "./schemas";

const SearchBarPropsSchema = z.object({
  query: z.string(),
  onQueryChange: z.custom<(value: string) => void>(),
  onSearch: z.custom<() => void>(),
  loading: z.boolean(),
  imagePanelOpen: z.boolean(),
  onToggleImagePanel: z.custom<() => void>(),
  imagePreview: z.string().nullable(),
  imageNote: z.string().nullable(),
  onImageFile: z.custom<(file: File) => void>(),
  onClearImage: z.custom<() => void>(),
  similarRef: SimilarRefSchema.nullable(),
  onClearSimilar: z.custom<() => void>(),
});
type SearchBarProps = z.infer<typeof SearchBarPropsSchema>;

const SimilarQueryBannerPropsSchema = z.object({
  similarRef: SimilarRefSchema,
  onClear: z.custom<() => void>(),
});
type SimilarQueryBannerProps = z.infer<typeof SimilarQueryBannerPropsSchema>;

function SimilarQueryBanner({ similarRef, onClear }: SimilarQueryBannerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-accent-cyan/40 bg-accent-cyan/5 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={similarRef.thumbUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-ui-border/60 object-cover" />
      <div className="min-w-0 flex-1">
        <p className="text-ui-xs font-medium text-accent-cyan">Showing images similar to</p>
        <p className="truncate text-ui-xs text-ui-ink-muted">{similarRef.summary}</p>
      </div>
      <button
        data-testid="library-similar-clear"
        className="rounded-lg border border-ui-border/60 px-2 py-1 text-ui-xs text-ui-ink-muted transition hover:border-accent-cyan hover:text-accent-cyan"
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}

/** The search bar row (text query + by-image toggle + submit), its inline
 * reverse-image dropzone, and the active "similar to" query banner. */
export function SearchBar(props: SearchBarProps) {
  return (
    <>
      <div className="flex flex-wrap items-stretch gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-ink-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            data-testid="library-search-input"
            className="w-full rounded-lg border border-ui-border/70 bg-ui-bg py-2 pl-9 pr-3 text-ui-sm outline-none focus:border-accent-cyan"
            placeholder="Search prompts, tags, filenames — or describe what you want…"
            value={props.query}
            onChange={(e) => props.onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.onSearch()}
          />
        </div>
        <button
          data-testid="library-search-by-image-toggle"
          className={`${cls.btn} flex items-center gap-1.5 ${props.imagePanelOpen ? cls.btnActive : ""}`}
          onClick={props.onToggleImagePanel}
          aria-pressed={props.imagePanelOpen}
          title="Search by image"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="hidden sm:inline">By image</span>
        </button>
        <button data-testid="library-search-submit" className={cls.btn} onClick={props.onSearch} disabled={props.loading}>
          {props.loading ? "Loading…" : "Search"}
        </button>
      </div>

      {props.imagePanelOpen && (
        <ImageDropzone preview={props.imagePreview} note={props.imageNote} onFile={props.onImageFile} onClear={props.onClearImage} />
      )}

      {props.similarRef && <SimilarQueryBanner similarRef={props.similarRef} onClear={props.onClearSimilar} />}
    </>
  );
}
