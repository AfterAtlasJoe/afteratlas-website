import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

// Deliberately short: this only needs to catch the actual redirect landing
// right after sign-up completes (near-instant for Credentials; a few
// seconds for the Google OAuth round trip). Too long a window and a user
// who signs up and then quickly, deliberately clicks "Create a checklist"
// gets silently bounced back to the page they're already on instead of
// proceeding — found exactly this while testing the flow.
const NEW_ACCOUNT_WINDOW_MS = 10_000;

/**
 * True if this account was created within the last ~10s — a lightweight
 * stand-in for "did this sign-in just create a new account". NextAuth v5
 * does expose a `trigger: "signUp"` signal, but only inside the `jwt`
 * callback, not the `redirect` callback that actually picks the landing
 * page — and under the JWT session strategy there's no clean way to
 * "consume" that flag once so it doesn't linger for the rest of the
 * token's lifetime. Checking account freshness at the landing page sidesteps
 * both problems and works identically for Credentials and OAuth signups,
 * since both set `User.createdAt` at the same instant the row is created.
 */
export function isFreshAccount(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() < NEW_ACCOUNT_WINDOW_MS;
}

/**
 * Sends a brand-new signup to the home page instead of wherever the
 * sign-in flow was otherwise headed (dashboard, or back into a checklist
 * they tried to start while logged out) — first-time users should land
 * somewhere orienting, not straight into app furniture or an immediate
 * disclaimer prompt. Returning users pass straight through. Call right
 * after the session/auth check on any page NextAuth might land a fresh
 * signup on (currently: dashboard and the survey/plan entry point).
 */
export async function redirectHomeIfJustSignedUp(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  if (user && isFreshAccount(user.createdAt)) {
    redirect("/");
  }
}
