export function SiteFooter() {
  return (
    <footer className="border-t border-black/10 py-8 text-center text-sm text-zinc-500 dark:border-white/10">
      <p>&copy; {new Date().getFullYear()} After Atlas</p>
    </footer>
  );
}
