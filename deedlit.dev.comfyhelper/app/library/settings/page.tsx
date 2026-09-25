"use client";

import Link from "next/link";

import { useSettings } from "@/lib/store/settings";

import { BrowsingSection } from "./_settings/BrowsingSection";
import { IngestSettingsSection } from "./_settings/IngestSettingsSection";
import { McpAccessSection } from "./_settings/McpAccessSection";
import { cls } from "./_settings/primitives";
import { SearchDefaultsSection } from "./_settings/SearchDefaultsSection";
import { SlideshowSection } from "./_settings/SlideshowSection";
import { SuggestionsSection } from "./_settings/SuggestionsSection";
import { useSettingsBinders, useSettingsDirty } from "./_settings/useSettingsBinders";
import { ViewerSection } from "./_settings/ViewerSection";

export default function SettingsPage() {
  const { settings, setKey, reset, hydrated } = useSettings();
  const binders = useSettingsBinders(settings, setKey);
  const dirty = useSettingsDirty(settings);

  return (
    <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-6" data-testid="settings-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-ui-2xl font-semibold text-ui-ink-title">Settings</h1>
          <p className="text-ui-sm text-ui-ink-muted">
            Tune browsing, the image viewer, and how suggestions are surfaced.
            Stored locally in this browser.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className={cls.btn} onClick={reset} disabled={!dirty} data-testid="settings-reset">
            Reset to defaults
          </button>
          <Link href="/library" prefetch={false} className="text-ui-sm text-accent-cyan">
            ← Back to library
          </Link>
        </div>
      </header>

      {!hydrated && <p className="text-ui-xs text-ui-ink-muted">Loading saved settings…</p>}

      {/* Cards flow into 2–3 balanced columns on wide desktops. CSS multi-column
          (not grid) so uneven card heights pack without leaving row gaps. */}
      <div className="columns-1 gap-6 lg:columns-2 2xl:columns-3 [&>section]:mb-6 [&>section]:break-inside-avoid">
        <BrowsingSection settings={settings} binders={binders} />
        <ViewerSection settings={settings} binders={binders} />
        <SuggestionsSection settings={settings} binders={binders} />
        <SlideshowSection settings={settings} binders={binders} />
        <SearchDefaultsSection settings={settings} binders={binders} />
        {/* Ingest & indexing (server-backed, not localStorage) */}
        <IngestSettingsSection />
        {/* Agent access (MCP) — connection details, not stored settings */}
        <McpAccessSection />
      </div>
    </div>
  );
}
