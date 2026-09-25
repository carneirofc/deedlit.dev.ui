"use client";

import Link from "next/link";

import { cls } from "./constants";

export function AdminQuickLinks() {
  return (
    <>
      {/* System health lives on its own page now — link across to it. */}
      <Link
        href="/admin/health"
        className={`${cls.card} flex items-center justify-between gap-3 transition hover:border-accent-cyan/60`}
        data-testid="health-link"
      >
        <span className="flex items-center gap-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 fill-none stroke-accent-cyan"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span>
            <span className="block text-ui-sm font-semibold text-ui-ink-title">System Health</span>
            <span className="block text-ui-2xs text-ui-ink-muted">
              Live status, dependency readiness &amp; activity for every backend service.
            </span>
          </span>
        </span>
        <span className="shrink-0 text-ui-sm text-ui-ink-muted">View ↗</span>
      </Link>

      <Link
        href="/admin/cache"
        className={`${cls.card} flex items-center justify-between gap-3 transition hover:border-accent-cyan/60`}
        data-testid="cache-link"
      >
        <span className="flex items-center gap-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 fill-none stroke-accent-cyan"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span>
            <span className="block text-ui-sm font-semibold text-ui-ink-title">Image Cache</span>
            <span className="block text-ui-2xs text-ui-ink-muted">
              Redis hit rate, entry counts, TTLs &amp; flush control for the thumbnail/original cache.
            </span>
          </span>
        </span>
        <span className="shrink-0 text-ui-sm text-ui-ink-muted">View ↗</span>
      </Link>
    </>
  );
}
