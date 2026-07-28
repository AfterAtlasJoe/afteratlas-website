export function SiteFooter() {
  return (
    <footer className="bg-black py-8 text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-6 text-sm text-white/70 sm:justify-between">
        <p>Copyright {new Date().getFullYear()} After Atlas. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
