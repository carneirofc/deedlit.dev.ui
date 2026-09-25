"use client";

import { Row, Section, NumberSlider, Toggle } from "./primitives";
import type { SettingsSectionProps } from "./schemas";

function SimilarImagesRows({ binders: { bool, slide } }: SettingsSectionProps) {
  return (
    <>
      <Row
        label="Show similar images"
        control={<Toggle {...bool("showSimilar")} testId="settings-toggle-show-similar" />}
      />
      <Row
        label="Similar images count"
        control={
          <NumberSlider
            {...slide("similarCount")}
            min={0}
            max={48}
            step={4}
            testId="settings-slider-similar-count"
            label="Similar images count"
          />
        }
      />
      <Row
        label="Similarity threshold"
        hint="Hide suggestions below this score."
        control={
          <NumberSlider
            {...slide("similarMinScore")}
            min={0}
            max={1}
            step={0.05}
            format={(v) => v.toFixed(2)}
            testId="settings-slider-similar-min-score"
            label="Similarity threshold"
          />
        }
      />
      <Row
        label="Load suggestions automatically"
        hint="Off shows a button so the viewer opens faster."
        control={<Toggle {...bool("autoLoadSuggestions")} testId="settings-toggle-auto-load-suggestions" />}
      />
    </>
  );
}

function RelatedTagsRows({ binders: { bool, slide } }: SettingsSectionProps) {
  return (
    <>
      <Row
        label="Show related tags"
        control={<Toggle {...bool("showRelatedTags")} testId="settings-toggle-show-related-tags" />}
      />
      <Row
        label="Related tags count"
        control={
          <NumberSlider
            {...slide("relatedTagsCount")}
            min={0}
            max={40}
            step={2}
            testId="settings-slider-related-tags-count"
            label="Related tags count"
          />
        }
      />
    </>
  );
}

export function SuggestionsSection(props: SettingsSectionProps) {
  return (
    <Section
      title="Suggestions & related items"
      hint="The similar-images and related-tags panels on the viewer."
    >
      <SimilarImagesRows {...props} />
      <RelatedTagsRows {...props} />
    </Section>
  );
}
