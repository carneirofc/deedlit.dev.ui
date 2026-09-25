import { z } from "zod";

import type { CompactResult, Graph } from "@/lib/library/schemas";

import { GraphSection } from "./GraphSection";
import { NotesSection } from "./NotesSection";
import { SimilarSection } from "./SimilarSection";
import { VectorDebugSection } from "./VectorDebugSection";
import type { useImageNotes } from "./useDetailData";
import type { useVectorDebug } from "./useDetailActions";

const DetailSectionsPropsSchema = z.object({
  showSimilar: z.boolean(),
  similar: z.array(z.custom<CompactResult>()),
  suggestLoading: z.boolean(),
  suggestRequested: z.boolean(),
  onLoadSuggestions: z.custom<() => void>(),
  debugState: z.custom<ReturnType<typeof useVectorDebug>>(),
  notesState: z.custom<ReturnType<typeof useImageNotes>>(),
  showRelationshipGraph: z.boolean(),
  graph: z.custom<Graph>().nullable(),
});
type DetailSectionsProps = z.infer<typeof DetailSectionsPropsSchema>;

/** Similar images, notes, vector debug and relationship-graph sections below
 * the main viewer/metadata row. */
export function DetailSections({
  showSimilar,
  similar,
  suggestLoading,
  suggestRequested,
  onLoadSuggestions,
  debugState,
  notesState,
  showRelationshipGraph,
  graph,
}: DetailSectionsProps) {
  return (
    <>
      {showSimilar && (
        <SimilarSection
          similar={similar}
          suggestLoading={suggestLoading}
          suggestRequested={suggestRequested}
          onLoadSuggestions={onLoadSuggestions}
          debugOpen={debugState.debugOpen}
          onToggleDebug={debugState.loadDebug}
        />
      )}

      <NotesSection
        notes={notesState.notes}
        notesLoading={notesState.notesLoading}
        noteDraft={notesState.noteDraft}
        onDraftChange={notesState.setNoteDraft}
        noteSaving={notesState.noteSaving}
        onAddNote={notesState.addNote}
      />

      {debugState.debugOpen && (
        <VectorDebugSection
          debug={debugState.debug}
          debugLoading={debugState.debugLoading}
          debugError={debugState.debugError}
        />
      )}

      {showRelationshipGraph && graph && graph.nodes.length > 0 && <GraphSection graph={graph} />}
    </>
  );
}
