import Link from "next/link";

import { auth, signOut } from "@/auth";
import { isAdminUser } from "@/lib/admin";

import { NavLinks } from "./nav-links";

/**
 * Three-column layout (nav / logo / actions) mirroring afteratlas.com's
 * header: no background of its own, so it blends into whatever the page
 * behind it is (the blush hero on marketing pages, plain white elsewhere).
 */
export async function SiteHeader() {
  const session = await auth();
  const isAdmin = session?.user?.id ? await isAdminUser(session.user.id) : false;

  return (
    <header>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-4 px-6 py-5 sm:grid-cols-[1fr_auto_1fr]">
        <NavLinks />

        <Link
          href="/"
          className="col-span-2 order-first text-center font-display text-lg font-semibold tracking-tight sm:order-none sm:col-span-1"
        >
          After Atlas
        </Link>

        <div className="flex items-center justify-end gap-4 text-sm font-medium">
          {session?.user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/profile" className="hidden sm:inline">
                Profile
              </Link>
              {isAdmin ? (
                <Link href="/admin" className="hidden sm:inline">
                  Admin
                </Link>
              ) : null}
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
              <Link href="/register" className="hidden sm:inline">
                Sign up
              </Link>
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
