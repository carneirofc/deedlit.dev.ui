# Services Feature

Powers `/portal`, the authenticated dashboard listing the cluster's services
and their health. Everything here is server-side; the only client code is the
search box and the copy-to-clipboard buttons.

## Structure

| Path                          | Role                                                     |
| ----------------------------- | -------------------------------------------------------- |
| `server/discover.ts`          | Lists services from the Kubernetes API                    |
| `server/health.ts`            | Probes each service in-cluster                            |
| `components/ServicesSection.tsx` | Renders the grid; search + copy only                   |
| `components/ServiceGlyph.tsx` | Icon lookup, with a `generic` fallback                    |
| `data/local-services.ts`      | Development fallback when there is no cluster             |
| `types.ts`                    | Shared types and the annotation contract                  |

## Where the list comes from

Nothing is hard-coded. `discoverServices()` lists Ingress objects labelled
`app.deedlit.dev/expose=true` through the Kubernetes API, authenticating with
the pod's projected ServiceAccount token and pinning the cluster CA. Display
metadata comes from `portal.deedlit.dev/*` annotations on each Ingress, so
adding a service is a values change in `deedlit.dev.infra`, never a change
here. The contract is defined in `types.ts` (`PORTAL_ANNOTATIONS`) and
documented in that repo's `apps/README.md`.

Outside the cluster there is no token, so `data/local-services.ts` is used
instead and the feature stays developable on a laptop.

## How health is checked

`checkServices()` probes `http://<service>.<namespace>.svc.cluster.local:<port><path>`
— the Ingress's **backing Service**, not the public hostname.

This matters. The previous implementation ran `fetch(url, {mode: "cors"})` from
the browser, which could never work: none of these services send CORS headers,
so every check failed and every card rendered "unreachable" no matter what was
actually running. Probing server-to-server removes CORS from the picture
entirely, and probing in-cluster means the result reflects the service rather
than the Cloudflare tunnel, DNS and certificate in front of it.

Anything answering below HTTP 500 counts as up — a registry replying `401` is
serving, which is the question being asked. Probes run concurrently with a 3s
timeout, so one dead service costs one timeout rather than N.

## Adding a service

Do it in `deedlit.dev.infra`, in the owning chart's `values.yaml`:

```yaml
ingress:
  portal:
    expose: true
  annotations:
    portal.deedlit.dev/name: Container Registry
    portal.deedlit.dev/category: ops
    portal.deedlit.dev/icon: registry
    portal.deedlit.dev/health-path: /v2/
```

To add a new **icon**, extend `ServiceIcon` and `SERVICE_ICONS` in `types.ts`
and add the glyph to `ServiceGlyph.tsx`. Unknown values fall back to `generic`
rather than rendering an empty card.

## Security notes

Annotations are operator-supplied input, so the probe target is never built
from a raw annotation. Namespace and service names are validated as DNS labels,
the port is range-checked, the path must be a simple absolute path, and
`health.ts` re-verifies the final URL is plain HTTP to a `.svc.cluster.local`
host before any request goes out. Redirects are not followed. Together that is
what stops a hostile annotation from turning the portal into an SSRF proxy.
