import { z } from "zod";

import { DbFilters } from "./DbFilters";
import { DbImageDetail } from "./DbImageDetail";
import { DbImageList } from "./DbImageList";
import type { useBulkSelection } from "./useBulkSelection";
import type { useCatalogList } from "./useCatalogList";
import type { useImageEditor } from "./useImageEditor";

const DbBodyPropsSchema = z.object({
  catalog: z.custom<ReturnType<typeof useCatalogList>>(),
  editor: z.custom<ReturnType<typeof useImageEditor>>(),
  bulk: z.custom<ReturnType<typeof useBulkSelection>>(),
});
type DbBodyProps = z.infer<typeof DbBodyPropsSchema>;

export function DbBody({ catalog, editor, bulk }: DbBodyProps) {
  return (
    <>
      <DbFilters
        tag={catalog.tag}
        onTagChange={catalog.setTag}
        path={catalog.path}
        onPathChange={catalog.setPath}
        safety={catalog.safety}
        onSafetyChange={catalog.setSafety}
        favorite={catalog.favorite}
        onFavoriteChange={catalog.setFavorite}
        onApply={catalog.load}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <DbImageList
          images={catalog.images}
          hasMore={catalog.hasMore}
          loadingMore={catalog.loadingMore}
          selectedSha={editor.selected?.sha256}
          picked={bulk.picked}
          onTogglePick={bulk.togglePick}
          onPickAllLoaded={bulk.pickAllLoaded}
          onSelect={editor.select}
          confirmingBulk={bulk.confirmingBulk}
          onRequestBulkExclude={() => bulk.setConfirmingBulk(true)}
          bulkBusy={bulk.bulkBusy}
          onExcludeSelected={bulk.excludeSelected}
          onCancelBulk={() => bulk.setConfirmingBulk(false)}
          onClearPicked={bulk.clearPicked}
          listScrollRef={catalog.listScrollRef}
          sentinelRef={catalog.sentinelRef}
        />

        <DbImageDetail
          selected={editor.selected}
          edit={editor.edit}
          onEditChange={editor.setEdit}
          busy={editor.busy}
          pathCopied={editor.pathCopied}
          onCopiedChange={editor.setPathCopied}
          onSave={editor.save}
          onReindex={() => editor.act("reindex")}
          onRelabel={() => editor.act("relabel")}
          onDeleteEverywhere={editor.deleteEverywhere}
        />
      </div>
    </>
  );
}
