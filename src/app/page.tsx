import Image from "next/image";
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
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-12 px-6 py-24 lg:flex-row lg:items-center lg:justify-between lg:text-left">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <h1 className="font-display text-4xl font-bold tracking-tight text-black sm:text-5xl">
            After Atlas: Post-Death Checklist
          </h1>
          <p className="max-w-xl text-lg text-zinc-700">
            Closing down an estate is a maze where it&apos;s not always clear
            where the beginning is or what the next turn should be. Let us
            help. Every situation is different, and the amount of loose ends
            to chase down can be overwhelming. Take our survey and get a
            customized checklist of things you should be considering.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
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

        <Image
          src="/writing-a-checklist.svg"
          alt="A hand checking items off a handwritten checklist"
          width={784}
          height={600}
          className="w-full max-w-md shrink-0 lg:max-w-lg"
          priority
        />
      </div>
    </div>
  );
}
