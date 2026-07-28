import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Structured as a list rather than a single hardcoded "death" CTA so this
  // page becomes a 2-3 option event-type chooser later just by seeding more
  // active EventType rows — no rebuild required.
  const eventTypes = await prisma.eventType.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="relative w-full overflow-hidden bg-blush">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-0 h-[36rem] w-[36rem] rounded-full bg-blush-deep/70 blur-2xl"
      />
      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-10 px-6 py-24 text-center">
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-4xl font-bold tracking-tight text-black sm:text-5xl">
            After Atlas
          </h1>
          <p className="text-lg text-zinc-700">
            A guided survey that turns a major life transition into a clear,
            personalized action checklist — plus vendors who can help.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {eventTypes.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No event types are active yet. Seed the database to get started.
            </p>
          ) : (
            eventTypes.map((eventType) => (
              <Link
                key={eventType.id}
                href={`/survey/${eventType.id}`}
                className="rounded-full border border-accent bg-accent-light px-6 py-3 font-display text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-light/70"
              >
                Start: {eventType.name}
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
