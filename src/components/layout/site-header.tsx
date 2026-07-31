import Link from "next/link";

import { auth, signOut } from "@/auth";
import { isAdminUser } from "@/lib/admin";

import { NavLinks } from "./nav-links";

/**
 * Stacked, centered rows on mobile (logo / nav / account links / auth
 * button) so nothing wraps into a stray line of its own; the same markup
 * becomes the three-column layout (nav / logo / actions) mirroring
 * afteratlas.com's header at the `sm` breakpoint and up. No background of
 * its own, so it blends into whatever the page behind it is (the blush
 * hero on marketing pages, plain white elsewhere).
 */
export async function SiteHeader() {
  const session = await auth();
  const isAdmin = session?.user?.id ? await isAdminUser(session.user.id) : false;

  return (
    <header>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-5 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
        <NavLinks />

        <Link
          href="/"
          className="order-first font-display text-lg font-semibold tracking-tight sm:order-none"
        >
          After Atlas
        </Link>

        <div className="flex flex-col items-center gap-2 text-sm font-medium sm:flex-row sm:justify-end sm:gap-4">
          {session?.user ? (
            <>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/profile">Profile</Link>
                {isAdmin ? <Link href="/admin">Admin</Link> : null}
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button
                  type="submit"
                  className="cursor-pointer rounded-full border border-accent bg-accent-light px-5 py-2 text-accent-ink"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/register">Sign up</Link>
              <Link
                href="/login"
                className="rounded-full border border-accent bg-accent-light px-5 py-2 text-accent-ink"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
