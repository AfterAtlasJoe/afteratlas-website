/** `text/javascript` on the server so it runs during HTML parsing (before React hydrates); `text/plain` on the client so it's inert on soft navigations, where the owning component re-renders the correct value directly instead. */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
