"use client";

// ---------------------------------------------------------------------------
// DB power-user / debug page (#30, ADR 0001).
//
// Browse/filter the catalog (Postgres) TRUTH, inspect the raw stored JSON
// (params / workflow_json / api_prompt_json), edit curated fields in place, and
// trigger per-image ops (re-index / re-label / delete-everywhere). Projection
// stores (Neo4j/Qdrant) are not edited here — they're rebuilt from truth.
// ---------------------------------------------------------------------------

import { DbBody } from "./_db/DbBody";
import { DbNotices } from "./_db/DbNotices";
import { useBulkSelection } from "./_db/useBulkSelection";
import { useCatalogList } from "./_db/useCatalogList";
import { useImageEditor } from "./_db/useImageEditor";
import { useNotices } from "./_db/useNotices";

export default function DbPage() {
  const notices = useNotices();
  const catalog = useCatalogList(notices.setError);
  const editor = useImageEditor({
    onError: notices.setError,
    onNotice: notices.setNotice,
    refreshList: catalog.load,
  });
  const bulk = useBulkSelection({
    images: catalog.images,
    setImages: catalog.setImages,
    selected: editor.selected,
    clearSelection: editor.clearSelection,
    onError: notices.setError,
    onNotice: notices.setNotice,
  });

  return (
    <div className="flex w-full min-w-0 flex-col gap-6" data-testid="db-page">
      <header>
        <h1 className="text-ui-2xl font-semibold text-ui-ink-title">Database (power tools)</h1>
        <p className="text-ui-sm text-ui-ink-muted">
          Browse and edit the catalog source of truth. Projections rebuild from here.
        </p>
      </header>

      <DbNotices error={notices.error} notice={notices.notice} />

      <DbBody catalog={catalog} editor={editor} bulk={bulk} />
    </div>
  );
}
