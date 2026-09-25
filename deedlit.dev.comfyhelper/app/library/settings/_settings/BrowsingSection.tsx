"use client";

import type { LibrarySettings } from "@/lib/store/settings";

import { Row, Section, Segmented, NumberSlider, Toggle } from "./primitives";
import type { SettingsSectionProps } from "./schemas";

function BrowsingLayoutRows({ binders: { seg } }: SettingsSectionProps) {
  return (
    <>
      <Row
        label="Open search on"
        hint="Text/tag search runs a hybrid keyword + semantic match; “By image” opens the reverse-image dropzone."
        control={
          <Segmented
            {...seg<LibrarySettings["defaultMode"]>("defaultMode")}
            options={[
              { value: "browse", label: "Search" },
              { value: "image", label: "By image" },
            ]}
            testIdPrefix="settings-mode"
          />
        }
      />
      <Row
        label="Layout"
        hint="How result cards are arranged."
        control={
          <Segmented
            {...seg<LibrarySettings["viewMode"]>("viewMode")}
            options={[
              { value: "grid", label: "Grid" },
              { value: "masonry", label: "Masonry" },
              { value: "list", label: "List" },
            ]}
            testIdPrefix="settings-viewmode"
          />
        }
      />
      <Row
        label="Density"
        hint="Card size / columns for grid & masonry."
        control={
          <Segmented
            {...seg<LibrarySettings["gridDensity"]>("gridDensity")}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
              { value: "spacious", label: "Spacious" },
            ]}
            testIdPrefix="settings-density"
          />
        }
      />
    </>
  );
}

function BrowsingToggleRows({ binders: { bool } }: SettingsSectionProps) {
  return (
    <>
      <Row
        label="Infinite scroll"
        hint="Auto-load the next page when you reach the bottom."
        control={<Toggle {...bool("infiniteScroll")} testId="settings-toggle-infinite-scroll" />}
      />
      <Row
        label="Show score chips"
        control={<Toggle {...bool("showScores")} testId="settings-toggle-show-scores" />}
      />
      <Row
        label="Show card metadata"
        control={<Toggle {...bool("showCardMeta")} testId="settings-toggle-show-card-meta" />}
      />
    </>
  );
}

export function BrowsingSection(props: SettingsSectionProps) {
  const { slide } = props.binders;
  return (
    <Section
      title="Browsing & pagination"
      hint="Controls the library grid, page size, and which tab opens first."
    >
      <Row
        label="Results per page"
        hint="How many images load per request / “Load more” step."
        control={
          <NumberSlider
            {...slide("pageSize")}
            min={10}
            max={200}
            step={10}
            testId="settings-slider-page-size"
            label="Results per page"
          />
        }
      />
      <BrowsingLayoutRows {...props} />
      <BrowsingToggleRows {...props} />
    </Section>
  );
}
