import { z } from "zod";

import type { CompareResult } from "@/lib/library/schemas";

import { GraphSection } from "./GraphSection";
import { ImageColumns } from "./ImageColumns";
import { MetadataSection } from "./MetadataSection";
import { PromptsSection } from "./PromptsSection";
import { SimilaritySection } from "./SimilaritySection";
import { TagsSection } from "./TagsSection";

const CompareResultsPropsSchema = z.object({
  data: z.custom<CompareResult>(),
  n: z.number(),
  onRemove: z.custom<(id: string) => void>(),
  onGraphNodeClick: z.custom<(id: string, type: string) => void>(),
});
type CompareResultsProps = z.infer<typeof CompareResultsPropsSchema>;

/** All comparison sections once a result with at least two images has loaded. */
export function CompareResults({ data, n, onRemove, onGraphNodeClick }: CompareResultsProps) {
  return (
    <>
      <ImageColumns images={data.images} n={n} onRemove={onRemove} />

      <SimilaritySection
        images={data.images}
        similarityAvailable={data.similarityAvailable}
        pairwiseSimilarity={data.pairwiseSimilarity}
      />

      <MetadataSection fields={data.fields} />

      <TagsSection images={data.images} n={n} sharedTags={data.sharedTags} uniqueTags={data.uniqueTags} />

      {data.images.some((i) => i.prompt) && <PromptsSection images={data.images} n={n} />}

      <GraphSection graph={data.graph} onNodeClick={onGraphNodeClick} />
    </>
  );
}
