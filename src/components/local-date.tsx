"use client";

import { useId } from "react";

import { InlineScript } from "./inline-script";

/**
 * Renders `date` in the visitor's own timezone, not the server's. The
 * server renders it in its own timezone first; an inline script corrects
 * it during HTML parsing (before React hydrates) on a hard load, and the
 * client re-render handles it directly on a soft navigation. See
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md —
 * a plain useEffect would show the server's (wrong) timezone first and
 * cause an extra render on every mount.
 */
export function LocalDate({
  date,
  options,
}: {
  date: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const id = useId();

  return (
    <>
      <time id={id} dateTime={date} suppressHydrationWarning>
        {new Date(date).toLocaleDateString(undefined, options)}
      </time>
      <InlineScript
        html={`{var n=document.getElementById("${id}");if(n)n.textContent=new Date("${date}").toLocaleDateString(undefined,${JSON.stringify(options)})}`}
      />
    </>
  );
}
