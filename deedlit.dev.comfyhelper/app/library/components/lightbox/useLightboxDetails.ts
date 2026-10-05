import { useEffect, useState } from "react";

import type { ImageDetail, LightboxItem } from "./schemas";
import { ImageDetailSchema } from "./schemas";

/** Inline details panel state: fetches the full image record when opened. */
export function useLightboxDetails(current: LightboxItem | undefined, detailsOpen: boolean) {
  const [detail, setDetail] = useState<ImageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  useEffect(() => {
    if (!detailsOpen || !current) return;
    let alive = true;
    // Data-fetching effect: marking the loading state synchronously before the
    // async call is the sanctioned fetch-in-effect pattern (not derived state).
    setDetailLoading(true);
    setDetail(null);
    setDetailError(false);
    fetch(`/api/library/images/${current.imageId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text().catch(() => r.statusText));
        return ImageDetailSchema.parse(await r.json());
      })
      .then((j) => { if (alive) setDetail(j); })
      .catch(() => { if (alive) setDetailError(true); })
      .finally(() => { if (alive) setDetailLoading(false); });
    return () => { alive = false; };
  }, [detailsOpen, current?.imageId]);

  return { detail, detailLoading, detailError };
}
