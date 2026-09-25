"use client";

import { z } from "zod";

import type { ViewMode } from "@/lib/store/settings";

import { EmptyState, ErrorBanner, FreshnessBanner, LoadMoreControl } from "./StatusBanners";
import { IngestPanel } from "./IngestPanel";
import { LibraryLightbox } from "./LibraryLightbox";
import { LibraryResultsGrid } from "./ResultsGrid";
import { ResultsHeader } from "./ResultsHeader";
import { SearchPanel } from "./SearchPanel";
import { SelectionBar } from "./SelectionBar";
import type { LibraryPageControls } from "./useLibraryPageState";
import type { useLibraryPageFetch } from "./useLibraryPageFetch";
import type { useLibraryPageDisplay } from "./useLibraryPageDisplay";

const LibraryPageBodyPropsSchema = z.object({
  c: z.custom<LibraryPageControls>(),
  fetch: z.custom<ReturnType<typeof useLibraryPageFetch>>(),
  display: z.custom<ReturnType<typeof useLibraryPageDisplay>>(),
});
type LibraryPageBodyProps = z.infer<typeof LibraryPageBodyPropsSchema>;

/** Header title, toolbar, search panel, and the status banners above the grid. */
function LibraryPageHeaderSection({ c, fetch, display }: LibraryPageBodyProps) {
  const imagePanelOpen = c.aux.showImageSearch || c.aux.mode === "image";
  return (
    <>
      <ResultsHeader
        resultCount={c.resultsState.results.length}
        hasMore={c.resultsState.hasMore}
        selectMode={c.selection.selectMode}
        onToggleSelectMode={() => (c.selection.selectMode ? c.selection.exitSelectMode() : c.selection.setSelectMode(true))}
        onStartSlideshow={() => c.lightbox.openLightbox(0, true)}
        browsePath={display.sort.browsePath}
        groupBy={c.settings.groupBy}
        onToggleGroupBy={() => c.setKey("groupBy", c.settings.groupBy === "folder" ? "none" : "folder")}
        sortValue={display.sort.sortValue}
        sortOptions={display.sort.sortOptions}
        onChangeSort={display.sort.changeSort}
        viewMode={c.settings.viewMode}
        onChangeViewMode={(v: ViewMode) => c.setKey("viewMode", v)}
      />

      <SearchPanel
        filters={c.filters}
        aux={c.aux}
        allTags={c.tagCatalog.allTags}
        fetchTagSuggestions={c.tagCatalog.fetchTagSuggestions}
        loading={c.resultsState.loading}
        doFetch={fetch.doFetch}
        search={fetch.search}
        clearImage={fetch.clearImage}
        applyExternalImage={fetch.applyExternalImage}
        clearSimilar={fetch.clearSimilar}
      />

      <ErrorBanner error={c.resultsState.error} />
      <FreshnessBanner hasNew={c.freshness.hasNew} onRefresh={() => fetch.doFetch(false)} />
      <EmptyState show={c.resultsState.results.length === 0 && !c.resultsState.loading} imagePanelOpen={imagePanelOpen} />
    </>
  );
}

/** The selection bar, results grid, and load-more control. */
function LibraryPageResultsSection({ c, fetch, display }: LibraryPageBodyProps) {
  const galleryProps = {
    viewMode: c.settings.viewMode,
    gridDensity: c.settings.gridDensity,
    limit: c.filters.limit,
    showCardMeta: c.settings.showCardMeta,
    showScores: c.settings.showScores,
    selectMode: c.selection.selectMode,
    isSelected: (id: string) => c.selection.selected.has(id),
    onToggleSelect: c.selection.toggleSelect,
    onOpen: c.lightbox.openLightbox,
    onFindSimilar: fetch.findSimilar,
  };

  return (
    <>
      <SelectionBar
        show={c.selection.selectMode && c.resultsState.results.length > 0}
        totalCount={c.resultsState.results.length}
        selection={c.selection}
        onSelectAllIds={() => c.resultsState.results.map((r) => r.imageId)}
        fetchTagSuggestions={c.tagCatalog.fetchTagSuggestions}
      />

      <LibraryResultsGrid
        show={c.resultsState.results.length > 0}
        grouping={display.grouping}
        sections={display.groupingState.groupSections}
        collapsedDirs={display.groupingState.collapsedDirs}
        dirTotals={display.groupingState.dirTotals}
        onToggleDir={display.groupingState.toggleDir}
        displayResults={display.sort.displayResults}
        galleryProps={galleryProps}
      />

      <LoadMoreControl hasMore={c.resultsState.hasMore} loading={c.resultsState.loading} onLoadMore={fetch.loadMore} sentinelRef={display.sentinelRef} />
    </>
  );
}

/** The ingest panel and the lightbox viewer. */
function LibraryPageOverlaySection({ c, fetch, display }: LibraryPageBodyProps) {
  return (
    <>
      <IngestPanel
        show={c.ingest.showIngest}
        onToggle={() => c.ingest.setShowIngest(!c.ingest.showIngest)}
        folderPath={c.ingest.folderPath}
        onFolderPathChange={c.ingest.setFolderPath}
        onStartIngest={c.ingest.startIngest}
        jobs={c.ingest.jobs}
      />

      <LibraryLightbox
        lightboxIndex={c.lightbox.lightboxIndex}
        autoPlay={c.lightbox.lightboxAutoPlay}
        galleryItems={display.groupingState.galleryItems}
        settings={c.settings}
        hasMore={c.resultsState.hasMore}
        loading={c.resultsState.loading}
        onLoadMore={fetch.loadMore}
        onClose={() => { c.lightbox.setLightboxIndex(null); c.urlSync.syncViewUrl(null); }}
        onCurrentChange={c.urlSync.syncViewUrl}
        onSimilar={(it) => fetch.findSimilar(it.imageId, it.thumbnailUrl, it.summary)}
        onToggleFullResolution={() => c.setKey("viewerFullResolution", !c.settings.viewerFullResolution)}
        onRating={c.imageActions.rateImage}
        fetchNotes={c.imageActions.fetchNotesForImage}
        onCreateNote={c.imageActions.createNoteForImage}
        onDelete={c.selection.deleteOne}
      />
    </>
  );
}

/** The full library page body: header/toolbar/search, the results grid, and
 * the ingest panel + lightbox overlays. Composed here so the page component
 * itself stays a thin orchestrator over the page-level hooks. */
export function LibraryPageBody(props: LibraryPageBodyProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <LibraryPageHeaderSection {...props} />
      <LibraryPageResultsSection {...props} />
      <LibraryPageOverlaySection {...props} />
    </div>
  );
}
