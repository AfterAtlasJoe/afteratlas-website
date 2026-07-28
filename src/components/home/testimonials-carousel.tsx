"use client";

import { useState } from "react";

const TESTIMONIALS = [
  {
    quote:
      "Wow, I can't imagine how people close out an estate WITHOUT a tool like this.",
    name: "Angie V",
  },
  {
    quote:
      "I was totally unprepared to go through this process. I had no idea the depth of things that need to be considered. After Atlas helped me feel like I was heading in the right direction.",
    name: "Chris L",
  },
  {
    quote:
      "After Atlas helped me start a meaningful conversation about this with my family members. It helped to remind me that it's important to share this information with loved ones.",
    name: "Ellen D",
  },
  {
    quote:
      "During a time when I felt lost at sea, After Atlas was the guide I needed to ensure I was investing my limited energy in the right direction.",
    name: "Lauren S",
  },
];

const PER_PAGE = 2;

export function TestimonialsCarousel() {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(TESTIMONIALS.length / PER_PAGE);
  const visible = TESTIMONIALS.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return (
    <div>
      <div className="grid gap-10 sm:grid-cols-2">
        {visible.map((testimonial) => (
          <blockquote key={testimonial.name}>
            <p aria-hidden className="font-display text-6xl leading-none text-blush-deep">
              &ldquo;
            </p>
            <p className="-mt-6 text-lg text-zinc-700">{testimonial.quote}</p>
            <footer className="mt-4 text-sm font-medium text-zinc-600">
              {testimonial.name}
            </footer>
          </blockquote>
        ))}
      </div>

      {pageCount > 1 ? (
        <div className="mt-10 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous testimonials"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-accent text-accent-ink transition-colors disabled:opacity-40"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
            aria-label="Next testimonials"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-accent bg-accent-light text-accent-ink transition-colors disabled:bg-transparent disabled:opacity-40"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
