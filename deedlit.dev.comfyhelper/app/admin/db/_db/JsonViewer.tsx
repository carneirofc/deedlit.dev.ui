import { z } from "zod";

const JsonViewerPropsSchema = z.object({
  label: z.string(),
  value: z.unknown(),
});
type JsonViewerProps = z.infer<typeof JsonViewerPropsSchema>;

export function JsonViewer({ label, value }: JsonViewerProps) {
  if (value == null) return null;
  return (
    <details className="rounded-lg border border-ui-border/40 bg-ui-bg p-2">
      <summary className="cursor-pointer text-ui-xs font-medium text-ui-ink-title">{label}</summary>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-ui-2xs text-ui-ink-muted">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
