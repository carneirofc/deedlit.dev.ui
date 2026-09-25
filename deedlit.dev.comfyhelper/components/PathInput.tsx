"use client";

import { z } from "zod";
import { PathInput as UiPathInput } from "@carneirofc/ui";

import { hasMixedSeparators, isAlreadyConfigured } from "@/lib/library/paths";
import { usePathPreview } from "@/lib/library/use-path-preview";

export const PathInputPropsSchema = z.object({
  value: z.string(),
  onChange: z.custom<(value: string) => void>(),
  /** Called when Enter is pressed in the text field (e.g. submit the form). */
  onEnter: z.custom<() => void>().optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().optional(),
  /** Class for the outer wrapper (use to size it within a row). */
  className: z.string().optional(),
  /** Class for the text input — pass the page's existing input styling. */
  inputClassName: z.string().optional(),
  /** Class for the Browse button — pass the page's existing button styling. */
  buttonClassName: z.string().optional(),
  pickerTitle: z.string().optional(),
  inputTestId: z.string().optional(),
  buttonTestId: z.string().optional(),
  /**
   * Show a live validation/preview line under the field: whether the path is a
   * real directory, how many images/sub-folders are in it, and mismatch/dupe
   * warnings. Off by default so unrelated callers are unaffected.
   */
  showPreview: z.boolean().optional(),
  /**
   * Already-configured source-folder paths. When provided (with showPreview),
   * a path that matches one is flagged as a duplicate before submit.
   */
  knownPaths: z.custom<readonly string[]>().optional(),
});
export type PathInputProps = z.infer<typeof PathInputPropsSchema>;

const PathPreviewLinePropsSchema = z.object({
  value: z.string(),
  knownPaths: z.custom<readonly string[]>().optional(),
});
type PathPreviewLineProps = z.infer<typeof PathPreviewLinePropsSchema>;

const PathPreviewStatusPropsSchema = z.object({
  preview: z.custom<ReturnType<typeof usePathPreview>>(),
});
type PathPreviewStatusProps = z.infer<typeof PathPreviewStatusPropsSchema>;

/** The path-count/validity line: checking, invalid, or valid with counts. */
function PathPreviewStatus({ preview }: PathPreviewStatusProps) {
  if (preview.state === "checking") return <span className="text-ui-ink-muted">Checking path…</span>;

  if (preview.state === "invalid") {
    return (
      <span className="text-rose-500" data-testid="path-preview-invalid">
        ✗ {preview.error}
      </span>
    );
  }

  if (preview.state === "valid") {
    return (
      <span className="text-emerald-500" data-testid="path-preview-valid">
        ✓ {preview.imageCount} image{preview.imageCount === 1 ? "" : "s"}
        {preview.subdirCount > 0
          ? ` · ${preview.subdirCount} sub-folder${preview.subdirCount === 1 ? "" : "s"}`
          : ""}{" "}
        here
      </span>
    );
  }

  return null;
}

/** The live validation/preview line shown under the field when enabled. */
function PathPreviewLine({ value, knownPaths }: PathPreviewLineProps) {
  const preview = usePathPreview(value);
  const trimmed = value.trim();
  if (!trimmed) return null;

  const duplicate = knownPaths ? isAlreadyConfigured(value, knownPaths) : false;
  const mixed = hasMixedSeparators(trimmed);

  return (
    <div className="flex flex-col gap-0.5 text-ui-2xs" data-testid="path-preview">
      <PathPreviewStatus preview={preview} />

      {duplicate && (
        <span className="text-amber-500" data-testid="path-preview-duplicate">
          ⚠ Already a configured source folder.
        </span>
      )}

      {mixed && (
        <span className="text-amber-500" data-testid="path-preview-mixed">
          ⚠ Path mixes “\” and “/” separators — check it is correct.
        </span>
      )}
    </div>
  );
}

/**
 * App adapter over the shared {@link UiPathInput}. Adds comfyhelper's live path
 * validation (via {@link usePathPreview}) as the package component's `preview`
 * slot, keeping filesystem/API coupling out of the shared package.
 */
export function PathInput({ showPreview, knownPaths, ...rest }: PathInputProps) {
  return (
    <UiPathInput
      {...rest}
      preview={showPreview ? <PathPreviewLine value={rest.value} knownPaths={knownPaths} /> : undefined}
    />
  );
}

export default PathInput;
