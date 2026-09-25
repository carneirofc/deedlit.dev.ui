import { z } from "zod";

const DbNoticesPropsSchema = z.object({
  error: z.string(),
  notice: z.string(),
});
type DbNoticesProps = z.infer<typeof DbNoticesPropsSchema>;

export function DbNotices({ error, notice }: DbNoticesProps) {
  return (
    <>
      {error && (
        <p className="text-ui-sm text-rose-500" data-testid="db-error">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-ui-sm text-emerald-500" data-testid="db-notice">
          {notice}
        </p>
      )}
    </>
  );
}
