"use client";

import { useRef } from "react";

import { bigSrc } from "./useLightboxImageLoad";
import type { LightboxStageProps, StageBadgesProps, TouchPoint } from "./schemas";

function useStageTouchNav(go: (dir: 1 | -1) => void) {
  const touchStart = useRef<TouchPoint | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Horizontal fling: dominant-axis + min distance, so taps and vertical
    // scrolls don't trigger navigation.
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  return { onTouchStart, onTouchEnd };
}

function StageLoadIndicators({ imgLoaded, imgError }: Pick<LightboxStageProps, "imgLoaded" | "imgError">) {
  return (
    <>
      {!imgLoaded && !imgError && (
        <div className="absolute inset-0 m-auto h-8 w-8 animate-pulse rounded-full border-2 border-ui-border/50 border-t-accent-cyan" aria-hidden="true" />
      )}
      {imgError && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-ui-ink-muted">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="m3 16 5-5c.9-.9 2.1-.9 3 0l5 5M14 13l1.5-1.5c.9-.9 2.1-.9 3 0L21 14M8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
            <path d="M4 4l16 16" />
          </svg>
          <p className="text-ui-xs">Failed to load image.</p>
        </div>
      )}
    </>
  );
}

function StageBadges({ fullResolution, score }: StageBadgesProps) {
  return (
    <>
      <span
        className={`pointer-events-none absolute bottom-3 left-3 rounded-md border px-2 py-1 text-ui-2xs font-semibold backdrop-blur ${
          fullResolution
            ? "border-accent-cyan bg-ui-bg/80 text-accent-cyan"
            : "border-ui-border/50 bg-ui-bg/70 text-ui-ink-muted"
        }`}
      >
        {fullResolution ? "HD · original" : "Thumbnail"}
      </span>

      {typeof score === "number" && score > 0 && (
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ui-bg/80 px-2.5 py-1 font-mono text-ui-2xs text-accent-cyan backdrop-blur">
          score {score.toFixed(3)}
        </span>
      )}
    </>
  );
}

const navBtn =
  "group absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-ui-border/40 bg-ui-bg/60 text-ui-ink backdrop-blur transition hover:border-accent-cyan hover:bg-ui-bg/90 hover:text-accent-cyan disabled:opacity-30";

export function LightboxStage({
  current,
  fullResolution,
  imgLoaded,
  setImgLoaded,
  imgError,
  setImgError,
  atStart,
  atEnd,
  go,
  onClose,
}: LightboxStageProps) {
  const { onTouchStart, onTouchEnd } = useStageTouchNav(go);

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button type="button" onClick={() => go(-1)} disabled={atStart} aria-label="Previous image" className={`${navBtn} left-2 sm:left-4`} data-testid="lightbox-nav-prev">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <StageLoadIndicators imgLoaded={imgLoaded} imgError={imgError} />

      <img
        key={current.imageId + (fullResolution ? "-hd" : "")}
        src={bigSrc(current, fullResolution)}
        alt={current.summary}
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        onError={() => { setImgLoaded(true); setImgError(true); }}
        className={`max-h-full max-w-full object-contain transition-opacity duration-200 ${imgLoaded && !imgError ? "opacity-100" : "opacity-0"}`}
      />

      <StageBadges fullResolution={fullResolution} score={current.score} />

      <button type="button" onClick={() => go(1)} disabled={atEnd} aria-label="Next image" className={`${navBtn} right-2 sm:right-4`} data-testid="lightbox-nav-next">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
