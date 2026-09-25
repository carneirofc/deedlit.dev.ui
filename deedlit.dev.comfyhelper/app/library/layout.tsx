import type { ReactNode } from "react";
import { z } from "zod";

import { CompareTrayBar } from "@/app/library/components/CompareTrayBar";

const LibraryLayoutPropsSchema = z.object({
  children: z.custom<ReactNode>(),
});
type LibraryLayoutProps = z.infer<typeof LibraryLayoutPropsSchema>;

/** Library section layout — mounts the global compare tray over every page. */
export default function LibraryLayout({ children }: LibraryLayoutProps) {
  return (
    <>
      {children}
      <CompareTrayBar />
    </>
  );
}
