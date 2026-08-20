import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="bg-black py-8 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 text-sm text-white/70 sm:flex-row sm:justify-between">
        <p>Copyright {new Date().getFullYear()} After Atlas. All Rights Reserved. 🚀</p>
        <Link href="/feedback?from=footer" className="underline">
          Give feedback
        </Link>
      </div>
    </footer>
  );
}
