"use client";

import { LibraryPageBody } from "@/app/library/_library-page/LibraryPageBody";
import { useLibraryPageControls } from "@/app/library/_library-page/useLibraryPageState";
import { useLibraryPageFetch } from "@/app/library/_library-page/useLibraryPageFetch";
import { useLibraryPageDisplay } from "@/app/library/_library-page/useLibraryPageDisplay";

export default function LibraryPage() {
  const c = useLibraryPageControls();
  const fetch = useLibraryPageFetch(c);
  const display = useLibraryPageDisplay(c, fetch);

  return <LibraryPageBody c={c} fetch={fetch} display={display} />;
}
