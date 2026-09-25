import { z } from "zod";

import { JsonViewer } from "./JsonViewer";
import type { CatalogImage } from "./schemas";

const DbImageJsonPanelsPropsSchema = z.object({
  selected: z.custom<CatalogImage>(),
});
type DbImageJsonPanelsProps = z.infer<typeof DbImageJsonPanelsPropsSchema>;

export function DbImageJsonPanels({ selected }: DbImageJsonPanelsProps) {
  return (
    <div className="flex flex-col gap-2">
      <JsonViewer label="params" value={selected.params} />
      <JsonViewer label="references" value={selected.references} />
      <JsonViewer label="workflow_json" value={selected.workflow_json} />
      <JsonViewer label="api_prompt_json" value={selected.api_prompt_json} />
    </div>
  );
}
