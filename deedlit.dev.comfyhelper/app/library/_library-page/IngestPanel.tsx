"use client";

import { z } from "zod";

import { PathInput } from "@/components/PathInput";

import { cls } from "./constants";
import { JobSummarySchema } from "./schemas";

const IngestPanelPropsSchema = z.object({
  show: z.boolean(),
  onToggle: z.custom<() => void>(),
  folderPath: z.string(),
  onFolderPathChange: z.custom<(value: string) => void>(),
  onStartIngest: z.custom<() => void>(),
  jobs: z.array(JobSummarySchema),
});
type IngestPanelProps = z.infer<typeof IngestPanelPropsSchema>;

function IngestJobList({ jobs }: Pick<IngestPanelProps, "jobs">) {
  if (jobs.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-ui-xs">
      {jobs.slice(0, 6).map((j) => (
        <li key={j.id} className="flex items-center justify-between rounded bg-ui-bg px-2 py-1">
          <span className="truncate">{j.folderPath}</span>
          <span className="ml-2 shrink-0 text-ui-ink-muted">
            {j.status} · {j.processedFiles}/{j.totalFiles}
            {j.failedFiles > 0 ? ` · ${j.failedFiles} err` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Collapsible "Ingest folder" panel: the folder picker + start button and
 * the live job list (polled while open). */
export function IngestPanel({ show, onToggle, folderPath, onFolderPathChange, onStartIngest, jobs }: IngestPanelProps) {
  return (
    <section className={cls.card}>
      <button data-testid="library-ingest-toggle" className="flex w-full items-center justify-between text-ui-sm font-medium text-ui-ink" onClick={onToggle}>
        <span>Ingest folder</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-4 w-4 transition-transform ${show ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {show && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <PathInput
              className="min-w-[12rem] flex-1"
              inputClassName={`${cls.input} flex-1`}
              buttonClassName={cls.btn}
              value={folderPath}
              onChange={onFolderPathChange}
              onEnter={onStartIngest}
              placeholder="D:/images/generated"
              pickerTitle="Choose a folder to ingest"
            />
            <button data-testid="library-ingest-start" className={cls.btn} onClick={onStartIngest}>
              Start ingestion
            </button>
          </div>
          <IngestJobList jobs={jobs} />
        </div>
      )}
    </section>
  );
}
