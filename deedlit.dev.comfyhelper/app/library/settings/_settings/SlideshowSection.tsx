"use client";

import { Row, Section, NumberSlider, Toggle } from "./primitives";
import type { SettingsSectionProps } from "./schemas";

export function SlideshowSection({ binders: { bool, slide } }: SettingsSectionProps) {
  return (
    <Section
      title="Slideshow"
      hint="The fullscreen viewer opened by clicking an image or the Slideshow button."
    >
      <Row
        label="Auto-advance interval"
        hint="Seconds each image is shown while the slideshow is playing."
        control={
          <NumberSlider
            {...slide("slideshowInterval")}
            min={1}
            max={60}
            step={1}
            format={(v) => `${v}s`}
            testId="settings-slider-slideshow-interval"
            label="Auto-advance interval"
          />
        }
      />
      <Row
        label="Loop"
        hint="Return to the first image after the last."
        control={<Toggle {...bool("slideshowLoop")} testId="settings-toggle-slideshow-loop" />}
      />
      <Row
        label="Shuffle"
        hint="Jump to a random image instead of the next in order."
        control={<Toggle {...bool("slideshowShuffle")} testId="settings-toggle-slideshow-shuffle" />}
      />
    </Section>
  );
}
