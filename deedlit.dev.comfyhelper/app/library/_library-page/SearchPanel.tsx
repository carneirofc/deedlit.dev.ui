"use client";

import { z } from "zod";

import { AdvancedFilters } from "./AdvancedFilters";
import { cls } from "./constants";
import { EssentialFilters } from "./EssentialFilters";
import type { FilterSnapshot } from "./schemas";
import { SearchBar } from "./SearchBar";
import { TagFilters } from "./TagFilters";
import type { AuxFilterControls, FilterControls } from "./useLibraryFilters";

const DoFetchSchema = z.custom<(append: boolean, overrides?: Partial<FilterSnapshot>) => void>();

const SearchPanelPropsSchema = z.object({
  filters: z.custom<FilterControls>(),
  aux: z.custom<AuxFilterControls>(),
  allTags: z.array(z.string()),
  fetchTagSuggestions: z.custom<(q: string) => Promise<string[]>>(),
  loading: z.boolean(),
  doFetch: DoFetchSchema,
  search: z.custom<() => void>(),
  clearImage: z.custom<() => void>(),
  applyExternalImage: z.custom<(file: File) => void>(),
  clearSimilar: z.custom<() => void>(),
});
type SearchPanelProps = z.infer<typeof SearchPanelPropsSchema>;

function SearchPanelQuery(props: SearchPanelProps) {
  const { filters: f, aux, allTags, fetchTagSuggestions, loading, doFetch, search, clearImage, applyExternalImage, clearSimilar } = props;
  const imagePanelOpen = aux.showImageSearch || aux.mode === "image";
  const toggleImagePanel = () => {
    if (imagePanelOpen) {
      aux.setShowImageSearch(false);
      if (aux.mode === "image") clearImage();
    } else {
      aux.setShowImageSearch(true);
    }
  };

  return (
    <>
      <SearchBar
        query={f.query}
        onQueryChange={f.setQuery}
        onSearch={search}
        loading={loading}
        imagePanelOpen={imagePanelOpen}
        onToggleImagePanel={toggleImagePanel}
        imagePreview={aux.imagePreview}
        imageNote={aux.imageNote}
        onImageFile={applyExternalImage}
        onClearImage={clearImage}
        similarRef={aux.similarRef}
        onClearSimilar={clearSimilar}
      />
      <TagFilters
        tags={f.tags}
        onTagsChange={f.setTags}
        onCommitTags={(next) => doFetch(false, { tags: next })}
        allTags={allTags}
        fetchTagSuggestions={fetchTagSuggestions}
        showAllTagChips={aux.showAllTagChips}
        onToggleShowAllTagChips={() => aux.setShowAllTagChips((v) => !v)}
      />
    </>
  );
}

function SearchPanelFilters({ filters: f, aux, fetchTagSuggestions, doFetch, search }: SearchPanelProps) {
  return (
    <>
      <EssentialFilters
        favorites={f.favorites}
        onFavoritesChange={(v) => { f.setFavorites(v); doFetch(false, { favorites: v }); }}
        minRating={f.minRating}
        onMinRatingChange={(v) => { f.setMinRating(v); doFetch(false, { minRating: v }); }}
        safety={f.safety}
        onSafetyChange={(next) => { f.setSafety(next); doFetch(false, { safety: next }); }}
        graphScope={aux.graphScope}
        onGraphScopeChange={(scope) => { aux.setGraphScope(scope); doFetch(false, { graphScope: scope }); }}
        relatedImageId={aux.similarRef?.id}
      />
      <AdvancedFilters
        show={f.showAdvanced}
        onToggle={() => f.setShowAdvanced((v) => !v)}
        pathFilter={f.pathFilter}
        onPathFilterChange={f.setPathFilter}
        onCommitPathFilter={(v) => doFetch(false, { pathFilter: v })}
        excludeTags={f.excludeTags}
        onExcludeTagsChange={f.setExcludeTags}
        onCommitExcludeTags={(next) => doFetch(false, { excludeTags: next })}
        fetchTagSuggestions={fetchTagSuggestions}
        modelFamily={f.modelFamily}
        onModelFamilyChange={f.setModelFamily}
        onSearch={search}
        checkpoint={f.checkpoint}
        onCheckpointChange={f.setCheckpoint}
        loras={f.loras}
        onLorasChange={f.setLoras}
        sourceTool={f.sourceTool}
        onSourceToolChange={f.setSourceTool}
        limit={f.limit}
        onLimitChange={f.setLimit}
        minScore={f.minScore}
        onMinScoreChange={f.setMinScore}
      />
    </>
  );
}

/** The unified search & filter card: search bar, primary tag picker + popular
 * tags, the favorites/rating/safety/graph essentials row, and the advanced
 * filters panel. Every control commits through `doFetch` so a change
 * re-queries instantly. */
export function SearchPanel(props: SearchPanelProps) {
  return (
    <section className={cls.card}>
      <div className="flex flex-col gap-3">
        <SearchPanelQuery {...props} />
        <SearchPanelFilters {...props} />
      </div>
    </section>
  );
}
