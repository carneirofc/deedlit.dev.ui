import type { Safety } from "@/lib/library/schemas";

export const SAFETY_LABEL: Record<Safety, string> = {
  sfw: "SFW",
  nsfw: "NSFW",
  explicit: "Explicit",
};
