"use client";

import { z } from "zod";

const AdminBannersPropsSchema = z.object({
  error: z.string().nullable(),
  notice: z.string().nullable(),
});
type AdminBannersProps = z.infer<typeof AdminBannersPropsSchema>;

export function AdminBanners({ error, notice }: AdminBannersProps) {
  return (
    <>
      {error && (
        <p className="text-ui-sm text-rose-500" data-testid="admin-error">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-ui-sm text-emerald-500" data-testid="admin-notice">
          {notice}
        </p>
      )}
    </>
  );
}
