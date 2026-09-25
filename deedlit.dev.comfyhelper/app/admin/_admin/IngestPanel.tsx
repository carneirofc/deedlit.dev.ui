"use client";

import type { Dispatch, SetStateAction } from "react";

import { z } from "zod";

import { PathInput } from "@/components/PathInput";
import { splitPaths } from "@/lib/library/paths";

import { cls, DEFAULT_INGEST_OPTIONS } from "./constants";
import { IngestOptionsSchema, type IngestOptions } from "./schemas";

const IngestPanelPropsSchema = z.object({
  folderPath: z.string(),
  setFolderPath: z.custom<Dispatch<SetStateAction<string>>>(),
  options: IngestOptionsSchema,
  toggleOption: z.custom<(key: keyof IngestOptions) => void>(),
  ingestBusy: z.boolean(),
  multiMode: z.boolean(),
  setMultiMode: z.custom<Dispatch<SetStateAction<boolean>>>(),
  multiText: z.string(),
  setMultiText: z.custom<Dispatch<SetStateAction<string>>>(),
  startIngest: z.custom<() => void>(),
});
type IngestPanelProps = z.infer<typeof IngestPanelPropsSchema>;

function IngestOptionsRow({ options, toggleOption }: Pick<IngestPanelProps, "options" | "toggleOption">) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      {(Object.keys(DEFAULT_INGEST_OPTIONS) as Array<keyof IngestOptions>).map((key) => (
        <label
          key={key}
          className="flex cursor-pointer items-center gap-1.5 text-ui-xs text-ui-ink"
        >
          <input
            type="checkbox"
            checked={options[key]}
            onChange={() => toggleOption(key)}
            className="rounded"
            data-testid={`ingest-opt-${key}`}
          />
          {key}
        </label>
      ))}
    </div>
  );
}

function IngestMultiForm({
  multiText,
  setMultiText,
  ingestBusy,
  startIngest,
}: Pick<IngestPanelProps, "multiText" | "setMultiText" | "ingestBusy" | "startIngest">) {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        className={`${cls.input} min-h-[5rem] font-mono`}
        value={multiText}
        onChange={(e) => setMultiText(e.target.value)}
        placeholder={"One folder path per line\nK:/comfyui/output\n/mnt/share/renders"}
        spellCheck={false}
        data-testid="ingest-multi-input"
      />
      <div className="flex items-center gap-2">
        <button
          className={cls.btn}
          onClick={startIngest}
          disabled={ingestBusy}
          data-testid="ingest-start"
        >
          {ingestBusy ? "Starting…" : "Start ingestion"}
        </button>
        <span className="text-ui-2xs text-ui-ink-muted">
          {splitPaths(multiText).length} path{splitPaths(multiText).length === 1 ? "" : "s"} · one job each
        </span>
      </div>
    </div>
  );
}

function IngestSingleForm({
  folderPath,
  setFolderPath,
  ingestBusy,
  startIngest,
}: Pick<IngestPanelProps, "folderPath" | "setFolderPath" | "ingestBusy" | "startIngest">) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <PathInput
        className="min-w-[14rem] flex-1"
        inputClassName={`${cls.input} flex-1`}
        buttonClassName={cls.btn}
        value={folderPath}
        onChange={setFolderPath}
        onEnter={startIngest}
        placeholder="K:/comfyui/.../ComfyUI/output"
        pickerTitle="Choose a folder to ingest"
        inputTestId="ingest-path-input"
        buttonTestId="ingest-browse"
        showPreview
      />
      <button
        className={cls.btn}
        onClick={startIngest}
        disabled={ingestBusy}
        data-testid="ingest-start"
      >
        {ingestBusy ? "Starting…" : "Start ingestion"}
      </button>
    </div>
  );
}

export function IngestPanel({
  folderPath,
  setFolderPath,
  options,
  toggleOption,
  ingestBusy,
  multiMode,
  setMultiMode,
  multiText,
  setMultiText,
  startIngest,
}: IngestPanelProps) {
  return (
    <section className={cls.card} data-testid="ingest-panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-ui-sm font-semibold text-ui-ink-title">Ingest folder</h2>
        <button
          type="button"
          className="text-ui-2xs text-accent-cyan hover:underline"
          onClick={() => setMultiMode((m) => !m)}
          data-testid="ingest-multi-toggle"
        >
          {multiMode ? "← Single folder" : "Ingest multiple +"}
        </button>
      </div>
      {multiMode ? (
        <IngestMultiForm
          multiText={multiText}
          setMultiText={setMultiText}
          ingestBusy={ingestBusy}
          startIngest={startIngest}
        />
      ) : (
        <IngestSingleForm
          folderPath={folderPath}
          setFolderPath={setFolderPath}
          ingestBusy={ingestBusy}
          startIngest={startIngest}
        />
      )}

      <IngestOptionsRow options={options} toggleOption={toggleOption} />
    </section>
  );
}
