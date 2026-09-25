import { z } from "zod";

import type { CompareImage } from "@/lib/library/schemas";

import { gridCols, panel } from "./styles";

const PromptsSectionPropsSchema = z.object({
  images: z.array(z.custom<CompareImage>()),
  n: z.number(),
});
type PromptsSectionProps = z.infer<typeof PromptsSectionPropsSchema>;

/** Full prompt text per image, shown only when at least one has a prompt. */
export function PromptsSection({ images, n }: PromptsSectionProps) {
  return (
    <section className={panel}>
      <h2 className="mb-2 text-ui-sm font-semibold text-ui-ink-title">Prompts</h2>
      <div className="grid gap-3" style={gridCols(n)}>
        {images.map((img) => (
          <p key={img.id} className="whitespace-pre-wrap text-ui-2xs text-ui-ink">
            {img.prompt ?? "—"}
          </p>
        ))}
      </div>
    </section>
  );
}
