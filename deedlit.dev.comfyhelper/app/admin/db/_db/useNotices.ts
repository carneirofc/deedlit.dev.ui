import { useState } from "react";

/** Shared error/notice banners for the page, exposed as setters that accept
 * `""` to clear (so the various hooks can reset both on every new action). */
export function useNotices() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return { error, setError, notice, setNotice };
}
