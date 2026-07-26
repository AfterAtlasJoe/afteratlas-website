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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-24 text-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          After Atlas
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          A guided survey that turns a major life transition into a clear,
          personalized action checklist — plus vendors who can help.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        {eventTypes.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No event types are active yet. Seed the database to get started.
          </p>
        ) : (
          eventTypes.map((eventType) => (
            <Link
              key={eventType.id}
              href={`/survey/${eventType.id}`}
              className="flex-1 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Start: {eventType.name}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
