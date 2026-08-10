import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /**
       * GitHub login (e.g. "carneirofc"), or the OIDC username claim —
       * `preferred_username`, falling back to email then `sub`.
       */
      username?: string;
      /** Which provider issued this session: "github" or "oidc". */
      provider?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    provider?: string;
  }
}
