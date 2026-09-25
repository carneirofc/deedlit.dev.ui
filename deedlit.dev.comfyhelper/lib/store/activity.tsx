"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";

import {
  applyJobsToActivities,
  errorMessage,
  extractError,
  hasActiveJob,
  isTerminal,
  normalizeJob,
  type Activity,
  type JobSnapshot,
} from "@/lib/store/activity-jobs";

export type { Activity, ActivityStatus, ActivityProgress } from "@/lib/store/activity-jobs";

// ---------------------------------------------------------------------------
// Tunables.
// ---------------------------------------------------------------------------

/** Jobs-poll cadence while a job-linked activity is in flight. */
const POLL_MS = 2000;
/** How long a succeeded row lingers in the dock before it auto-prunes. */
const PRUNE_SUCCESS_MS = 4000;
/** Cap on retained rows so a long session can't grow unbounded. */
const MAX_ROWS = 40;

// Monotonic activity ids (module-scoped, never reused, SSR-safe).
let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `act-${idCounter}`;
}

// ---------------------------------------------------------------------------
// Context value.
// ---------------------------------------------------------------------------

const ActivityValueSchema = z.object({
  /** Newest-first list of tracked backend interactions. */
  activities: z.custom<Activity[]>(),
  /** Latest polled jobs snapshot (shared so pages need not re-poll). */
  jobs: z.custom<JobSnapshot[]>(),
  jobsLoading: z.boolean(),
  /**
   * Wrap a one-shot mutation: pushes a running row, then marks it
   * success/error when `fn` settles. Re-throws so callers keep their own
   * try/catch. Returns whatever `fn` resolves to.
   */
  track: z.custom<<T>(label: string, fn: () => Promise<T>) => Promise<T>>(),
  /**
   * `track` + fetch + JSON: does the fetch, ok-check and error-detail
   * extraction in one call. Throws on a non-2xx response.
   */
  fetchJson: z.custom<<T = unknown>(label: string, input: RequestInfo | URL, init?: RequestInit) => Promise<T>>(),
  /** Register a job-linked row the poller will drive to completion. No-op if jobId is falsy. */
  trackJob: z.custom<(label: string, jobId: string | null | undefined) => void>(),
  /** Remove one row from the dock. */
  dismiss: z.custom<(id: string) => void>(),
  /** Remove every settled (success/error) row. */
  clearFinished: z.custom<() => void>(),
});
type ActivityValue = z.infer<typeof ActivityValueSchema>;

const ActivityContext = createContext<ActivityValue | null>(null);

const ActivityProviderPropsSchema = z.object({
  children: z.custom<ReactNode>(),
});
type ActivityProviderProps = z.infer<typeof ActivityProviderPropsSchema>;

const JobsResponseSchema = z.object({
  jobs: z.array(z.unknown()).optional(),
});

// --- Jobs poller: runs only while a job-linked activity is unsettled. ------
function useJobsPoller(
  activities: Activity[],
  setJobs: (jobs: JobSnapshot[]) => void,
  setActivities: (fn: (prev: Activity[]) => Activity[]) => void,
  setJobsLoading: (loading: boolean) => void,
): void {
  const polling = hasActiveJob(activities);
  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    const poll = async () => {
      setJobsLoading(true);
      try {
        const res = await fetch("/api/library/jobs", { cache: "no-store" });
        const parsed = JobsResponseSchema.safeParse(await res.json());
        const list = (parsed.success ? parsed.data.jobs : undefined)?.map(normalizeJob) ?? [];
        if (cancelled) return;
        setJobs(list);
        setActivities((prev) => applyJobsToActivities(prev, list, Date.now()));
      } catch {
        // transient; the next tick retries.
      } finally {
        if (!cancelled) setJobsLoading(false);
      }
    };
    void poll();
    const handle = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [polling, setJobs, setActivities, setJobsLoading]);
}

// --- Auto-prune succeeded rows after a short linger. -----------------------
function usePruneSuccessRows(activities: Activity[], setActivities: (fn: (prev: Activity[]) => Activity[]) => void): void {
  const pruneTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = pruneTimers.current;
    for (const a of activities) {
      if (a.status === "success" && !timers.has(a.id)) {
        const handle = setTimeout(() => {
          timers.delete(a.id);
          setActivities((prev) => prev.filter((x) => x.id !== a.id));
        }, PRUNE_SUCCESS_MS);
        timers.set(a.id, handle);
      }
    }
  }, [activities, setActivities]);
  useEffect(() => {
    const timers = pruneTimers.current;
    return () => {
      for (const handle of timers.values()) clearTimeout(handle);
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Provider.
// ---------------------------------------------------------------------------

const ActivityActionsSchema = z.object({
  push: z.custom<(a: Activity) => void>(),
  patch: z.custom<(id: string, fields: Partial<Activity>) => void>(),
  track: z.custom<<T>(label: string, fn: () => Promise<T>) => Promise<T>>(),
  fetchJson: z.custom<<T = unknown>(label: string, input: RequestInfo | URL, init?: RequestInit) => Promise<T>>(),
  trackJob: z.custom<(label: string, jobId: string | null | undefined) => void>(),
  dismiss: z.custom<(id: string) => void>(),
  clearFinished: z.custom<() => void>(),
});
type ActivityActions = z.infer<typeof ActivityActionsSchema>;

const ActivityRowMutatorsSchema = z.object({
  push: z.custom<(a: Activity) => void>(),
  patch: z.custom<(id: string, fields: Partial<Activity>) => void>(),
  dismiss: z.custom<(id: string) => void>(),
  clearFinished: z.custom<() => void>(),
});
type ActivityRowMutators = z.infer<typeof ActivityRowMutatorsSchema>;

function useActivityRowMutators(setActivities: (fn: (prev: Activity[]) => Activity[]) => void): ActivityRowMutators {
  const push = useCallback(
    (a: Activity) => {
      setActivities((prev) => [a, ...prev].slice(0, MAX_ROWS));
    },
    [setActivities],
  );

  const patch = useCallback(
    (id: string, fields: Partial<Activity>) => {
      setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...fields } : a)));
    },
    [setActivities],
  );

  const dismiss = useCallback(
    (id: string) => {
      setActivities((prev) => prev.filter((a) => a.id !== id));
    },
    [setActivities],
  );

  const clearFinished = useCallback(() => {
    setActivities((prev) => prev.filter((a) => !isTerminal(a.status)));
  }, [setActivities]);

  return { push, patch, dismiss, clearFinished };
}

function useActivityActions(setActivities: (fn: (prev: Activity[]) => Activity[]) => void): ActivityActions {
  const { push, patch, dismiss, clearFinished } = useActivityRowMutators(setActivities);

  const track = useCallback(
    async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
      const id = nextId();
      push({ id, label, status: "running", startedAt: Date.now() });
      try {
        const result = await fn();
        patch(id, { status: "success", endedAt: Date.now() });
        return result;
      } catch (e) {
        patch(id, { status: "error", message: errorMessage(e), endedAt: Date.now() });
        throw e;
      }
    },
    [push, patch],
  );

  const fetchJson = useCallback(
    <T = unknown,>(label: string, input: RequestInfo | URL, init?: RequestInit): Promise<T> =>
      track(label, async () => {
        const res = await fetch(input, init);
        let body: unknown;
        try {
          body = await res.json();
        } catch {
          body = undefined;
        }
        if (!res.ok) throw new Error(extractError(body, res));
        return body as T;
      }),
    [track],
  );

  const trackJob = useCallback(
    (label: string, jobId: string | null | undefined) => {
      if (!jobId) return;
      push({
        id: nextId(),
        label,
        status: "running",
        jobId,
        progress: { processed: 0, total: 0, failed: 0 },
        startedAt: Date.now(),
      });
    },
    [push],
  );

  return { push, patch, track, fetchJson, trackJob, dismiss, clearFinished };
}

export function ActivityProvider({ children }: ActivityProviderProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [jobs, setJobs] = useState<JobSnapshot[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const { track, fetchJson, trackJob, dismiss, clearFinished } = useActivityActions(setActivities);

  useJobsPoller(activities, setJobs, setActivities, setJobsLoading);
  usePruneSuccessRows(activities, setActivities);

  const value = useMemo<ActivityValue>(
    () => ({
      activities,
      jobs,
      jobsLoading,
      track,
      fetchJson,
      trackJob,
      dismiss,
      clearFinished,
    }),
    [activities, jobs, jobsLoading, track, fetchJson, trackJob, dismiss, clearFinished],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityValue {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used within ActivityProvider");
  return ctx;
}
