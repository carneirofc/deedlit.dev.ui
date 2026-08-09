import type {
  LocalServiceApp,
  ServiceHealth,
  ServiceHealthMap
} from "@/features/services/types";

/**
 * Server-side health probing.
 *
 * This replaces a browser-side `fetch(url, {mode:"cors"})` that could never
 * work: none of these services send CORS headers, so every check failed and
 * every card rendered "unreachable" regardless of reality.
 *
 * Probes go to the backend Service inside the cluster
 * (`svc.cluster.local`), not the public hostname. That answers "is the service
 * up" without depending on Cloudflare, DNS, or the certificate — and being
 * server-to-server, CORS never enters into it.
 */

const PROBE_TIMEOUT_MS = 3_000;

/**
 * `probeUrl` is assembled in `discover.ts` from validated DNS labels and a
 * sanitized path, but it passes through operator-controlled annotations on the
 * way, so it is re-checked here before any request goes out. Only plain HTTP
 * to an in-cluster name is allowed — that is what keeps a hostile annotation
 * from turning the portal into an SSRF proxy.
 */
function isProbeTargetAllowed(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "http:") return false;
  if (url.username || url.password) return false;
  if (!url.hostname.endsWith(".svc.cluster.local")) return false;

  return true;
}

async function probe(service: LocalServiceApp): Promise<ServiceHealth> {
  const checkedAt = new Date().toISOString();

  if (!service.probeUrl) {
    return { state: "unknown", detail: "No in-cluster backend to probe", checkedAt };
  }

  if (!isProbeTargetAllowed(service.probeUrl)) {
    return { state: "unknown", detail: "Probe target rejected", checkedAt };
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(service.probeUrl, {
      method: "GET",
      // Never chase a redirect: the destination is outside what was validated.
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });

    const responseTime = Date.now() - startedAt;

    // The question is "is this service answering", not "does it like me".
    // A 3xx (console redirect), 401 (a registry demanding auth) or 404 all
    // prove the process is serving; only a 5xx means it is actually broken.
    const healthy = response.status < 500;

    return {
      state: healthy ? "up" : "down",
      responseTime,
      detail: healthy ? undefined : `HTTP ${response.status}`,
      checkedAt
    };
  } catch (error) {
    const responseTime = Date.now() - startedAt;
    const timedOut = error instanceof Error && error.name === "TimeoutError";

    return {
      state: "down",
      responseTime,
      detail: timedOut ? `Timed out after ${PROBE_TIMEOUT_MS}ms` : "Connection failed",
      checkedAt
    };
  }
}

/** Probes every service concurrently; one slow service costs one timeout, not N. */
export async function checkServices(services: LocalServiceApp[]): Promise<ServiceHealthMap> {
  const results = await Promise.all(
    services.map(async (service) => [service.id, await probe(service)] as const)
  );

  return Object.fromEntries(results);
}
