import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { logger } from "@/lib/logger";

/**
 * Authentication for the private `/portal` area.
 *
 * Sessions are JWT-only: the portal stores nothing per user, so adding a
 * database adapter would buy nothing and cost a datastore. Authorization is
 * decided once, in `signIn` — GitHub tells us *who* someone is, the org/team
 * membership check decides whether they get in at all.
 */

const GITHUB_API = "https://api.github.com";
const GITHUB_API_TIMEOUT_MS = 5_000;

/** Eight hours: long enough to avoid re-auth during a session of work. */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * The session cookie is a JWE signed and encrypted with `AUTH_SECRET`, so
 * forging one means brute-forcing that value. Auth.js only checks that the
 * secret exists; a deployment that set it to `changeme` would authenticate
 * fine and be trivially forgeable. 32 characters is the length `openssl rand
 * -base64 32` produces and the floor Auth.js documents.
 */
const MIN_SECRET_LENGTH = 32;

/**
 * Checked per sign-in rather than at module load: this module is imported
 * during `next build`, where no secret exists and a throw would break CI.
 */
function hasUsableSecret(): boolean {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length >= MIN_SECRET_LENGTH) return true;

  logger.error(
    "Portal sign-in denied: AUTH_SECRET is missing or shorter than " +
      `${MIN_SECRET_LENGTH} characters, which would leave session tokens forgeable`
  );
  return false;
}

/**
 * `AUTH_URL` is what stops `trustHost` from being a liability.
 *
 * `trustHost: true` is mandatory behind Traefik, but it means Auth.js derives
 * its own origin from the request's `Host`/`X-Forwarded-Host` header — which a
 * client sets. Pinning `AUTH_URL` makes the origin configuration rather than
 * input, so sign-in links, cookie scope and the OAuth `redirect_uri` cannot be
 * steered by a forged header. It also decides `useSecureCookies` below.
 */
const configuredAuthUrl = process.env.AUTH_URL?.trim();

const allowedOrg = () => process.env.AUTH_ALLOWED_GITHUB_ORG?.trim() ?? "";
const allowedTeam = () => process.env.AUTH_ALLOWED_GITHUB_TEAM?.trim() ?? "";

const allowedUsers = () =>
  (process.env.AUTH_ALLOWED_GITHUB_USERS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

async function githubGet(path: string, token: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    signal: AbortSignal.timeout(GITHUB_API_TIMEOUT_MS),
    cache: "no-store"
  });
}

/**
 * True when the user is an *active* member of the configured org. Uses the
 * `/user/memberships` endpoint rather than `/orgs/{org}/members/{user}`
 * because it reports private memberships too — a member whose membership is
 * concealed should still be able to sign in.
 */
async function isActiveOrgMember(org: string, token: string): Promise<boolean> {
  const response = await githubGet(`/user/memberships/orgs/${encodeURIComponent(org)}`, token);
  if (!response.ok) return false;

  const membership = (await response.json()) as { state?: string };
  return membership.state === "active";
}

async function isActiveTeamMember(
  org: string,
  team: string,
  login: string,
  token: string
): Promise<boolean> {
  const response = await githubGet(
    `/orgs/${encodeURIComponent(org)}/teams/${encodeURIComponent(team)}/memberships/${encodeURIComponent(login)}`,
    token
  );
  if (!response.ok) return false;

  const membership = (await response.json()) as { state?: string };
  return membership.state === "active";
}

/**
 * Decides whether a freshly authenticated GitHub user may use the portal.
 *
 * Fails closed: every failure path — no token, no rule configured, API error,
 * timeout, inactive membership — returns false. A misconfiguration locks
 * everyone out rather than letting everyone in.
 */
async function isAuthorized(login: string, token: string | undefined): Promise<boolean> {
  const normalizedLogin = login.toLowerCase();

  if (allowedUsers().includes(normalizedLogin)) return true;

  const org = allowedOrg();
  if (!org) return false;

  if (!token) {
    logger.warn("Portal sign-in denied: GitHub returned no access token", { login });
    return false;
  }

  try {
    if (!(await isActiveOrgMember(org, token))) return false;

    const team = allowedTeam();
    if (team) return await isActiveTeamMember(org, team, login, token);

    return true;
  } catch (error) {
    logger.error("Portal sign-in denied: GitHub membership check failed", {
      login,
      reason: error instanceof Error ? error.message : "unknown error"
    });
    return false;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      // `read:org` is what makes the membership lookup above possible;
      // the default scope cannot see org membership at all.
      authorization: { params: { scope: "read:user user:email read:org" } }
    })
  ],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  // The cookie must expire with the session it carries, or a stale token stays
  // presentable after the session it represents is over.
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
  // Auth.js cannot infer its own origin from behind Traefik without this.
  // Safe only in combination with AUTH_URL — see above.
  trustHost: true,
  // Forces the `__Secure-` cookie prefix and the Secure attribute, so the
  // session cookie is never emitted over plaintext where a network attacker
  // could strip TLS and capture it. Derived from AUTH_URL when set so that
  // running the production build against http://127.0.0.1 still works.
  useSecureCookies: configuredAuthUrl
    ? configuredAuthUrl.startsWith("https://")
    : process.env.NODE_ENV === "production",
  pages: {
    signIn: "/login",
    error: "/login"
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (!hasUsableSecret()) return false;
      if (account?.provider !== "github") return false;

      const login = typeof profile?.login === "string" ? profile.login : "";
      if (!login) return false;

      const authorized = await isAuthorized(login, account.access_token);
      if (!authorized) {
        logger.warn("Portal sign-in denied: not an authorized GitHub member", { login });
      }

      return authorized;
    },

    async jwt({ token, profile }) {
      // Only on initial sign-in does `profile` exist. The GitHub access token
      // is deliberately NOT persisted here — it has done its job in `signIn`,
      // and keeping it would park a live credential in the session cookie.
      if (typeof profile?.login === "string") {
        token.username = profile.login;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && typeof token.username === "string") {
        session.user.username = token.username;
      }
      return session;
    }
  }
});
