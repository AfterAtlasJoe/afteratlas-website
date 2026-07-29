import Image from "next/image";
import Link from "next/link";

import { TestimonialsCarousel } from "@/components/home/testimonials-carousel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PROCESS_STEPS = [
  {
    step: "1",
    title: "Survey your situation",
    text: "Answer questions about the particulars of the estate you are trying to close out.",
  },
  {
    step: "2",
    title: "Close out the estate",
    text: "Cross off the items on your checklist and close out your estate with a bit of guidance.",
  },
  {
    step: "3",
    title: "Get a customized checklist",
    text: "We send you a detailed and customized checklist based on your unique inputs.",
  },
];

export default async function Home() {
  // Structured as a list rather than a single hardcoded "death" CTA so this
  // page becomes a 2-3 option event-type chooser later just by seeding more
  // active EventType rows — no rebuild required.
  const eventTypes = await prisma.eventType.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-1 flex-col">
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
                    Create Your Checklist
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

      {/*
        Explicit bg-white, same reasoning as the About/Blog pages — the
        reference site has no dark mode, so this section (unlike the hero
        above, which already sits on a fixed bg-blush) needs a fixed light
        background of its own rather than inheriting the app's dark-mode
        page background while keeping hardcoded black/zinc text.
      */}
      <div className="w-full bg-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-20 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-black">
            Our Process is Simple
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {PROCESS_STEPS.map((item) => (
              <div key={item.step} className="relative pt-14">
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 font-display text-6xl font-bold text-blush-deep"
                >
                  {item.step}
                </span>
                <p className="relative font-display text-xl font-semibold text-black">
                  {item.title}
                </p>
                <p className="relative mt-2 text-zinc-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 pb-20 lg:flex-row lg:items-center lg:justify-between">
          <div className="lg:max-w-md">
            <h2 className="font-display text-4xl font-bold tracking-tight text-black">
              Our Mission
            </h2>
            <p className="mt-6 text-lg text-zinc-700">
              To be a free resource for individuals that need guidance on how to
              navigate the massive amount of tasks that need to be considered
              when closing up someone&apos;s estate. To empower people with
              clear direction during a time that can often feel overwhelming
              and paralyzing.
            </p>
            <Link
              href="/about"
              className="mt-8 inline-block rounded-full border border-accent bg-accent-light px-6 py-3 font-display text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-light/70"
            >
              Read more
            </Link>
          </div>

          <Image
            src="/updated-phone-checklist.svg"
            alt="A phone showing a checklist app with checked-off items"
            width={477}
            height={520}
            className="w-full max-w-xs shrink-0"
          />
        </div>
      </div>

      <div className="relative w-full overflow-hidden bg-blush">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 h-[30rem] w-[30rem] rounded-full bg-blush-deep/60 blur-2xl"
        />
        <div className="relative mx-auto w-full max-w-4xl px-6 py-20">
          <h2 className="text-center font-display text-4xl font-bold tracking-tight text-black">
            People Say
          </h2>
          <div className="mt-14">
            <TestimonialsCarousel />
          </div>
        </div>
      </div>
    </div>
  );
}
