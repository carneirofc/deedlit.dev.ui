"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

/**
 * Re-runs discovery and the health probes by invalidating the portal's render.
 * A server action rather than a client fetch loop: the probing has to happen
 * in-cluster, and this keeps a single code path for it.
 */
export async function refreshServices(): Promise<void> {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/portal");

  revalidatePath("/portal");
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
