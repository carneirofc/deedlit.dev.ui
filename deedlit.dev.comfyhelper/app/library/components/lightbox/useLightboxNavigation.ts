import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { z } from "zod";

import type { LightboxItem, LightboxLive, SlideshowSettings } from "./schemas";

const GoActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("id"), id: z.string() }),
  z.object({ type: z.literal("loadMore") }),
  z.object({ type: z.literal("stop") }),
]);
type GoAction = z.infer<typeof GoActionSchema>;

function pickShuffleId(list: LightboxItem[]): string {
  return list[Math.floor(Math.random() * list.length)].imageId;
}

/** What happens when `go` walks past the last item: pull more results if
 * available, loop back to the start, or stop the slideshow. */
function resolveGoOverflow(list: LightboxItem[], hasMore: boolean, loop: boolean): GoAction {
  if (hasMore) return { type: "loadMore" };
  if (loop) return { type: "id", id: list[0].imageId };
  return { type: "stop" }; // reached the end of a non-looping run
}

/** Pure resolution of what `go(dir)` should do, given a snapshot of the live
 * navigation state — kept outside the hook so it's independently testable and
 * doesn't inflate the hook's own complexity. */
function resolveGoAction(live: LightboxLive, dir: 1 | -1, playing: boolean): GoAction {
  const { items: list, hasMore: more, slideshow: ss, currentId: cid, index } = live;
  if (list.length === 0) return { type: "stop" };
  let i = list.findIndex((it) => it.imageId === cid);
  if (i === -1) i = Math.min(index, list.length - 1);

  if (dir === 1 && ss.shuffle && playing) return { type: "id", id: pickShuffleId(list) };

  const next = i + dir;
  if (next < 0) return { type: "id", id: list[ss.loop ? list.length - 1 : 0].imageId };
  if (next >= list.length) return resolveGoOverflow(list, more, ss.loop);
  return { type: "id", id: list[next].imageId };
}

/** Tracks the displayed image by *id*, not by position (the result list can
 * reorder, grow, or have rows spliced under the viewer), resolving its live
 * index each render. */
function useLightboxPosition(items: LightboxItem[], initialIndex: number) {
  const [currentId, setCurrentId] = useState<string | null>(
    () => items[initialIndex]?.imageId ?? items[0]?.imageId ?? null,
  );

  // If the tracked image vanished (the list changed under us) land on the
  // original open slot, clamped — a rare safety net; `go()` reads this
  // resolved index so navigation continues cleanly.
  const found = items.findIndex((it) => it.imageId === currentId);
  const index =
    found !== -1
      ? found
      : Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1));
  const current = items[index];

  return { currentId, setCurrentId, index, current };
}

/** Latest values for the slideshow timer / `go`, which close over their first
 * render otherwise. */
function useLightboxLiveRef(live: LightboxLive) {
  const ref = useRef<LightboxLive>(live);
  useEffect(() => {
    ref.current = live;
  });
  return ref;
}

function useLightboxGo(
  liveRef: React.RefObject<LightboxLive>,
  onLoadMore: () => void,
  playing: boolean,
  setPlaying: Dispatch<SetStateAction<boolean>>,
  setCurrentId: Dispatch<SetStateAction<string | null>>,
) {
  // Jump to a position by resolving it to the image id that lives there.
  const goToIndex = useCallback(
    (i: number) => {
      const list = liveRef.current.items;
      const it = list[Math.max(0, Math.min(i, list.length - 1))];
      if (it) setCurrentId(it.imageId);
    },
    [liveRef, setCurrentId],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      const action = resolveGoAction(liveRef.current, dir, playing);
      if (action.type === "id") setCurrentId(action.id);
      else if (action.type === "loadMore") onLoadMore(); // stay put; the next tick advances once results grow
      else setPlaying(false);
    },
    [liveRef, playing, onLoadMore, setPlaying, setCurrentId],
  );

  return { go, goToIndex };
}

function useLightboxSlideshowTimer(playing: boolean, interval: number, go: (dir: 1 | -1) => void) {
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => go(1), Math.max(1, interval) * 1000);
    return () => clearInterval(id);
  }, [playing, interval, go]);
}

/** Pull more results as we approach the end so navigation never dead-ends. */
function useLightboxAutoLoadMore(
  hasMore: boolean,
  loadingMore: boolean,
  index: number,
  itemsLength: number,
  onLoadMore: () => void,
) {
  useEffect(() => {
    if (hasMore && !loadingMore && index >= itemsLength - 3) onLoadMore();
  }, [index, hasMore, loadingMore, itemsLength, onLoadMore]);
}

/** Owns the slideshow-advance / auto-load-more logic on top of the tracked
 * position (see `useLightboxPosition`). */
export function useLightboxNavigation(
  items: LightboxItem[],
  initialIndex: number,
  hasMore: boolean,
  loadingMore: boolean,
  slideshow: SlideshowSettings,
  onLoadMore: () => void,
  playing: boolean,
  setPlaying: Dispatch<SetStateAction<boolean>>,
) {
  const { currentId, setCurrentId, index, current } = useLightboxPosition(items, initialIndex);
  const live = useLightboxLiveRef({ index, items, hasMore, slideshow, currentId });
  const { go, goToIndex } = useLightboxGo(live, onLoadMore, playing, setPlaying, setCurrentId);

  useLightboxSlideshowTimer(playing, slideshow.interval, go);
  useLightboxAutoLoadMore(hasMore, loadingMore, index, items.length, onLoadMore);

  return { currentId, setCurrentId, index, current, go, goToIndex, live };
}

export function isLightboxAtStart(index: number, loop: boolean): boolean {
  return index === 0 && !loop;
}

export function isLightboxAtEnd(index: number, itemsLength: number, loop: boolean, hasMore: boolean): boolean {
  return index === itemsLength - 1 && !loop && !hasMore;
}
