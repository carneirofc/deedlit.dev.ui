import { readFile } from "node:fs/promises";
import { request as httpsRequest } from "node:https";
import { logger } from "@/lib/logger";
import {
  PORTAL_ANNOTATIONS,
  PORTAL_EXPOSE_LABEL,
  SERVICE_CATEGORIES,
  SERVICE_ICONS,
  type LocalServiceApp,
  type ServiceCategory,
  type ServiceIcon
} from "@/features/services/types";
import { localServiceApps } from "@/features/services/data/local-services";

/**
 * Discovers the portal's service list from the Kubernetes API.
 *
 * The portal reads Ingress objects labelled `app.deedlit.dev/expose=true` and
 * takes their display metadata from `portal.deedlit.dev/*` annotations, so
 * adding a service to the portal is a values-file change in the infra repo —
 * no rebuild here.
 *
 * A single GET against one API group is the whole requirement, so this talks
 * to the apiserver with `fetch` rather than pulling in `@kubernetes/client-node`,
 * which would add megabytes to the standalone bundle for no gain.
 */

const SA_DIR = "/var/run/secrets/kubernetes.io/serviceaccount";
const TOKEN_PATH = `${SA_DIR}/token`;
const CA_PATH = `${SA_DIR}/ca.crt`;
const API_TIMEOUT_MS = 5_000;

const API_HOST =
  process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT
    ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`
    : "https://kubernetes.default.svc";

interface IngressBackendService {
  name?: string;
  port?: { number?: number; name?: string };
}

interface ServiceListResponse {
  items?: Array<{
    metadata?: { name?: string; namespace?: string };
    spec?: { ports?: Array<{ name?: string; port?: number }> };
  }>;
}

interface IngressListResponse {
  items?: Array<{
    metadata?: {
      name?: string;
      namespace?: string;
      uid?: string;
      annotations?: Record<string, string>;
    };
    spec?: {
      rules?: Array<{
        host?: string;
        http?: { paths?: Array<{ backend?: { service?: IngressBackendService } }> };
      }>;
    };
  }>;
}

async function readClusterCredentials(): Promise<{ token: string; ca: string } | null> {
  try {
    const [token, ca] = await Promise.all([
      readFile(TOKEN_PATH, "utf8"),
      readFile(CA_PATH, "utf8")
    ]);

    return { token: token.trim(), ca };
  } catch {
    return null;
  }
}

/**
 * `fetch` has no way to pin a CA per request, and the apiserver certificate is
 * signed by the cluster's own root — so this one call drops to `node:https`
 * rather than disabling verification or leaning on a `NODE_EXTRA_CA_CERTS`
 * env var that a deployment could forget to set.
 */
function getJson(
  url: string,
  { token, ca }: { token: string; ca: string }
): Promise<{ status: number; body: string }> {
  const target = new URL(url);

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        ca,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        timeout: API_TIMEOUT_MS
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );

    req.on("timeout", () => req.destroy(new Error(`Timed out after ${API_TIMEOUT_MS}ms`)));
    req.on("error", reject);
    req.end();
  });
}

function pickAnnotation(
  annotations: Record<string, string> | undefined,
  key: string
): string | undefined {
  const value = annotations?.[key]?.trim();
  return value ? value : undefined;
}

function parseIcon(raw: string | undefined): ServiceIcon {
  return SERVICE_ICONS.includes(raw as ServiceIcon) ? (raw as ServiceIcon) : "generic";
}

function parseCategory(raw: string | undefined): ServiceCategory {
  return SERVICE_CATEGORIES.includes(raw as ServiceCategory)
    ? (raw as ServiceCategory)
    : "other";
}

function parseOrder(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 100;
}

/**
 * Annotations are operator-supplied strings, so the probe path is validated
 * rather than trusted: it must be a simple absolute path. Anything with a
 * scheme, an authority (`//host`), or traversal is rejected back to "/" —
 * this is what stops an annotation from redirecting the prober at an
 * arbitrary target.
 */
function parseHealthPath(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("..")) return "/";
  if (/[^\w\-./~%?=&]/.test(raw)) return "/";
  return raw;
}

function parsePort(raw: string | undefined, fallback: number | undefined): number | undefined {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) return parsed;
  return fallback;
}

/** RFC 1123 label check — namespace and service names are used to build a URL. */
function isValidDnsLabel(value: string | undefined): value is string {
  return !!value && /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value) && value.length <= 63;
}

/**
 * Ingress backends usually name their port (`api`, `console`, `http`) rather
 * than numbering it, and a name cannot be dialled. This maps
 * `namespace/service` → { portName → number } from the Service objects so a
 * named backend can still be probed.
 */
type PortLookup = Map<string, Map<string, number>>;

function buildPortLookup(body: ServiceListResponse): PortLookup {
  const lookup: PortLookup = new Map();

  for (const item of body.items ?? []) {
    const { name, namespace } = item.metadata ?? {};
    if (!name || !namespace) continue;

    const ports = new Map<string, number>();
    for (const port of item.spec?.ports ?? []) {
      if (port.name && typeof port.port === "number") ports.set(port.name, port.port);
    }

    lookup.set(`${namespace}/${name}`, ports);
  }

  return lookup;
}

function toServiceApp(
  item: NonNullable<IngressListResponse["items"]>[number],
  portLookup: PortLookup
): LocalServiceApp | null {
  const namespace = item.metadata?.namespace;
  const ingressName = item.metadata?.name;
  const annotations = item.metadata?.annotations;

  const rule = item.spec?.rules?.find((candidate) => candidate.host);
  const host = rule?.host;
  if (!host || !ingressName || !isValidDnsLabel(namespace)) return null;

  const backend = rule?.http?.paths?.find((path) => path.backend?.service?.name)?.backend?.service;
  const backendName = backend?.name;

  // Prefer an explicit number, then resolve a named port through the Service,
  // and let the annotation override either.
  const namedPort =
    backend?.port?.name && backendName
      ? portLookup.get(`${namespace}/${backendName}`)?.get(backend.port.name)
      : undefined;

  const port = parsePort(
    pickAnnotation(annotations, PORTAL_ANNOTATIONS.healthPort),
    backend?.port?.number ?? namedPort
  );

  // Built entirely from validated components — never from a raw annotation.
  const probeUrl =
    isValidDnsLabel(backendName) && port
      ? `http://${backendName}.${namespace}.svc.cluster.local:${port}${parseHealthPath(
          pickAnnotation(annotations, PORTAL_ANNOTATIONS.healthPath)
        )}`
      : undefined;

  return {
    id: item.metadata?.uid ?? `${namespace}/${ingressName}`,
    name: pickAnnotation(annotations, PORTAL_ANNOTATIONS.name) ?? ingressName,
    host,
    url: `https://${host}`,
    description:
      pickAnnotation(annotations, PORTAL_ANNOTATIONS.description) ?? `Ingress in ${namespace}.`,
    status: "online",
    category: parseCategory(pickAnnotation(annotations, PORTAL_ANNOTATIONS.category)),
    icon: parseIcon(pickAnnotation(annotations, PORTAL_ANNOTATIONS.icon)),
    order: parseOrder(pickAnnotation(annotations, PORTAL_ANNOTATIONS.order)),
    probeUrl
  };
}

/**
 * Returns every portal-exposed service. Outside the cluster (local `next dev`)
 * there is no ServiceAccount token, so the static list is used instead and the
 * feature stays developable on a laptop.
 */
export async function discoverServices(): Promise<LocalServiceApp[]> {
  const credentials = await readClusterCredentials();
  if (!credentials) {
    logger.debug("No Kubernetes ServiceAccount token; using the static service list");
    return [...localServiceApps].sort(byOrderThenName);
  }

  const selector = encodeURIComponent(`${PORTAL_EXPOSE_LABEL}=true`);
  const ingressUrl = `${API_HOST}/apis/networking.k8s.io/v1/ingresses?labelSelector=${selector}`;
  const serviceUrl = `${API_HOST}/api/v1/services`;

  try {
    const [ingressResponse, serviceResponse] = await Promise.all([
      getJson(ingressUrl, credentials),
      getJson(serviceUrl, credentials)
    ]);

    if (ingressResponse.status < 200 || ingressResponse.status >= 300) {
      logger.error("Kubernetes ingress discovery failed", { status: ingressResponse.status });
      return [];
    }

    // A failure here is not fatal: without it, named-port backends simply get
    // no probe URL and render as "unknown" rather than the whole page failing.
    const portLookup =
      serviceResponse.status >= 200 && serviceResponse.status < 300
        ? buildPortLookup(JSON.parse(serviceResponse.body) as ServiceListResponse)
        : new Map();

    const body = JSON.parse(ingressResponse.body) as IngressListResponse;
    const services = (body.items ?? [])
      .map((item) => toServiceApp(item, portLookup))
      .filter((service): service is LocalServiceApp => service !== null);

    logger.info(`Discovered ${services.length} portal services from Kubernetes`);
    return services.sort(byOrderThenName);
  } catch (error) {
    logger.error("Kubernetes ingress discovery threw", {
      reason: error instanceof Error ? error.message : "unknown error"
    });
    return [];
  }
}

function byOrderThenName(a: LocalServiceApp, b: LocalServiceApp): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}
