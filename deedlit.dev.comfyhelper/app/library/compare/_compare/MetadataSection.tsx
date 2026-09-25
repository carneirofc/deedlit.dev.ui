import { z } from "zod";

import type { CompareField } from "@/lib/library/schemas";

import { panel } from "./styles";

const MetadataSectionPropsSchema = z.object({
  fields: z.array(z.custom<CompareField>()),
});
type MetadataSectionProps = z.infer<typeof MetadataSectionPropsSchema>;

/** Row-per-field diff table, highlighting rows where values differ. */
export function MetadataSection({ fields }: MetadataSectionProps) {
  return (
    <section className={panel}>
      <h2 className="mb-2 text-ui-sm font-semibold text-ui-ink-title">Metadata</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-ui-xs">
          <tbody>
            {fields.map((f) => (
              <tr
                key={f.key}
                className={`border-b border-ui-border/40 ${f.allEqual ? "" : "bg-amber-500/5"}`}
              >
                <th className="py-1.5 pr-3 text-left align-top font-medium text-ui-ink-muted">
                  {f.label}
                </th>
                {f.values.map((v, i) => (
                  <td
                    key={i}
                    className={`py-1.5 pr-3 align-top ${f.allEqual ? "text-ui-ink-muted" : "text-ui-ink"}`}
                  >
                    {v ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
