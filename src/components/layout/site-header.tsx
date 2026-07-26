import Link from "next/link";

import { auth, signOut } from "@/auth";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold">
          After Atlas
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/blog">Blog</Link>
          {session?.user ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button type="submit" className="cursor-pointer">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Log in</Link>
              <Link href="/register">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
