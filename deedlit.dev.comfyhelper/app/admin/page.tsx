"use client";

import { useState } from "react";

import { SourceFoldersPanel } from "@/components/SourceFoldersPanel";

import { AdminBanners } from "./_admin/AdminBanners";
import { AdminHeader } from "./_admin/AdminHeader";
import { AdminQuickLinks } from "./_admin/AdminQuickLinks";
import { IngestPanel } from "./_admin/IngestPanel";
import { JobsPanel } from "./_admin/JobsPanel";
import { MaintenancePanel } from "./_admin/MaintenancePanel";
import { MissingFilesPanel } from "./_admin/MissingFilesPanel";
import { useIngestForm } from "./_admin/useIngestForm";
import { useJobsBoard } from "./_admin/useJobsBoard";
import { useMaintenanceActions } from "./_admin/useMaintenanceActions";
import { useMissingFiles } from "./_admin/useMissingFiles";

export default function AdminPage() {
  // Global feedback — shared across ingest, maintenance & job-cancel actions.
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const jobsBoard = useJobsBoard(setError);
  const ingest = useIngestForm(setError, setNotice, jobsBoard.refreshJobs);
  const maintenance = useMaintenanceActions(() => setError(null), jobsBoard.refreshJobs);
  const missingFiles = useMissingFiles();

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6" data-testid="admin-page">
      <AdminHeader />
      <AdminQuickLinks />
      <AdminBanners error={error} notice={notice} />

      <IngestPanel
        folderPath={ingest.folderPath}
        setFolderPath={ingest.setFolderPath}
        options={ingest.options}
        toggleOption={ingest.toggleOption}
        ingestBusy={ingest.ingestBusy}
        multiMode={ingest.multiMode}
        setMultiMode={ingest.setMultiMode}
        multiText={ingest.multiText}
        setMultiText={ingest.setMultiText}
        startIngest={ingest.startIngest}
      />

      {/* Configured source folders — persistent registry + per-folder auto-scan */}
      <SourceFoldersPanel />

      <MaintenancePanel runs={maintenance.runs} runMaintenance={maintenance.runMaintenance} />

      <MissingFilesPanel
        missingState={missingFiles.missingState}
        missing={missingFiles.missing}
        missingError={missingFiles.missingError}
        missingNotice={missingFiles.missingNotice}
        selectedMissing={missingFiles.selectedMissing}
        deletingMissing={missingFiles.deletingMissing}
        scanMissingFiles={missingFiles.scanMissingFiles}
        toggleMissing={missingFiles.toggleMissing}
        toggleAllMissing={missingFiles.toggleAllMissing}
        deleteSelectedMissing={missingFiles.deleteSelectedMissing}
      />

      <JobsPanel
        jobs={jobsBoard.jobs}
        expanded={jobsBoard.expanded}
        toggleExpanded={jobsBoard.toggleExpanded}
        detail={jobsBoard.detail}
        refreshJobs={jobsBoard.refreshJobs}
        cancelJob={jobsBoard.cancelJob}
      />
    </div>
  );
}
