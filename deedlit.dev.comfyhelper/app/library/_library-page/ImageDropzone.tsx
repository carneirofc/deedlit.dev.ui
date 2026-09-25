"use client";

import { useRef, useState } from "react";
import { z } from "zod";

import { cls } from "./constants";

const ImageDropzonePropsSchema = z.object({
  preview: z.string().nullable(),
  note: z.string().nullable(),
  onFile: z.custom<(file: File) => void>(),
  onClear: z.custom<() => void>(),
});
type ImageDropzoneProps = z.infer<typeof ImageDropzonePropsSchema>;

/** Inline reverse-image search dropzone: paste, drag-drop, or choose a file. */
export function ImageDropzone({ preview, note, onFile, onClear }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pickFirstImage = (files: FileList | null | undefined) => {
    const file = Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); pickFirstImage(e.dataTransfer.files); }}
      onPaste={(e) => pickFirstImage(e.clipboardData.files)}
      className={`flex items-center gap-4 rounded-lg border border-dashed p-4 transition ${
        dragging ? "border-accent-cyan bg-accent-cyan/10" : "border-ui-border/70 bg-ui-bg/40"
      }`}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="query" className="h-20 w-20 shrink-0 rounded-lg border border-ui-border/60 object-cover" />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-ui-border/40 text-ui-ink-muted">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 20" />
          </svg>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-ui-sm font-medium text-ui-ink-title">Search by image</p>
        <p className="text-ui-xs text-ui-ink-muted">
          Paste (Ctrl/Cmd+V), drop, or choose a file. The image is embedded and matched — never stored.
        </p>
        {note && <p className="mt-1 text-ui-2xs text-ui-ink-muted/80">{note}</p>}
        <div className="mt-2 flex gap-2">
          <button data-testid="library-image-dropzone-choose-file" className={cls.btn} onClick={() => inputRef.current?.click()}>Choose file</button>
          {preview && <button data-testid="library-image-dropzone-clear" className={cls.btn} onClick={onClear}>Clear</button>}
        </div>
      </div>

      <input
        ref={inputRef}
        data-testid="library-image-dropzone-file-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { pickFirstImage(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
