import Image from "next/image";
import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Mirrors the structure and style of afteratlas.com/about — the founder's
 * own story, the mission, a testimonial, and the "how it works" steps
 * already reused from the home page's copy.
 */
export default async function AboutPage() {
  const eventTypes = await prisma.eventType.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  const ctaHref =
    eventTypes.length === 1 ? `/survey/${eventTypes[0].id}` : "/";

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative w-full overflow-hidden bg-blush">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full bg-blush-deep/70 blur-2xl"
        />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-20 lg:flex-row lg:items-center lg:justify-between">
          <div className="lg:max-w-xl">
            <h1 className="font-display text-5xl font-bold tracking-tight text-black">
              Our Story
            </h1>
            <div className="mt-8 flex flex-col gap-6 text-lg text-zinc-700">
              <p>
                In 2013 I lost my mother suddenly in a random accident. As her
                only heir, the responsibility of closing out everything
                related to her estate (house, financial accounts, funeral
                arrangements, filing with the courts, obtaining death
                certificates, etc.) fell onto my shoulders. As a 30 year old
                that had never dealt with this before, I found the process to
                be overwhelming.
              </p>
              <p>
                Gripped with analysis paralysis, I searched online for a
                comprehensive resource that could give me some guidance on
                what steps I needed to take. I felt like I was adrift in
                space and just needed someone to point me in the right
                direction. My search for a resource that could offer some
                direction came up empty handed and I became determined to
                create a tool that could help others going through a similar
                situation.
              </p>
              <p className="italic">— Joe Mangan (Founder)</p>
            </div>
          </div>

          <Image
            src="/cluttered-desk.svg"
            alt="A cluttered desk with a clock, photos, a letter, glasses, keys, and credit cards scattered together"
            width={1681}
            height={1451}
            className="w-full max-w-xs shrink-0 lg:max-w-sm"
            priority
          />
        </div>
      </div>

      {/*
        The reference site has no dark mode, so these sections (unlike the
        hero above, which already sits on a fixed bg-blush) get an explicit
        bg-white here — without it they'd inherit the app's dark-mode page
        background while keeping hardcoded black/zinc text, making "Our
        Mission" and "Our Process" illegible for visitors in dark mode.
      */}
      <div className="w-full bg-white">
        <div className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-black">
            Our Mission
          </h2>
          <p className="mt-6 text-lg text-zinc-700">
            To be a free resource for individuals that need guidance on how to
            navigate the massive amount of tasks that need to be considered
            when closing up someone&apos;s estate. To empower people with
            clear direction during a time that can often feel overwhelming
            and paralyzing.
          </p>

          <blockquote className="mt-16">
            <p className="font-display text-2xl font-bold text-black">
              &ldquo;Wow, I can&apos;t imagine how people close out an estate
              WITHOUT a tool like this.&rdquo;
            </p>
            <footer className="mt-3 text-sm italic text-zinc-600">
              — Angie V.
            </footer>
          </blockquote>
        </div>

        <div className="mx-auto w-full max-w-3xl px-6 pb-20 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-black">
            Our Process
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            {[
              {
                step: "1",
                text: "You fill out a survey that asks you several specific questions about your situation.",
              },
              {
                step: "2",
                text: "As you fill out the survey you are presented with resources that can help you make sense of what to do next.",
              },
              {
                step: "3",
                text: "Once you're done with your survey, you are presented with your personalized to-do list based on your situation.",
              },
            ].map((item) => (
              <div key={item.step} className="relative pt-14">
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 font-display text-6xl font-bold text-blush-deep"
                >
                  {item.step}
                </span>
                <p className="relative text-zinc-700">{item.text}</p>
              </div>
            ))}
          </div>

          <Link
            href={ctaHref}
            className="mt-14 inline-block rounded-full border border-accent bg-accent-light px-6 py-3 font-display text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-light/70"
          >
            Create your checklist
          </Link>
        </div>
      </div>
    </div>
  );
}
