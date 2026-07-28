import { NextRequest, NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/html";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Meant to be hit once a day by a scheduler (see vercel.json — daily is
 * also the most frequent cron Vercel's Hobby plan allows) — checks every
 * admin who's opted into a daily/weekly/monthly digest (rather than
 * "instant", which is sent immediately at signup time from
 * notifyAdminsOfNewSignup) and, once their window has elapsed since
 * `digestLastSentAt`, emails them the new signups since then.
 */
export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admins = await prisma.user.findMany({
    where: { isAdmin: true, adminDigestFrequency: { in: ["daily", "weekly", "monthly"] } },
    select: { id: true, email: true, adminDigestFrequency: true, digestLastSentAt: true },
  });

  const now = new Date();
  let digestsSent = 0;

  for (const admin of admins) {
    const frequency = admin.adminDigestFrequency as keyof typeof WINDOW_MS;
    const windowMs = WINDOW_MS[frequency];
    const since = admin.digestLastSentAt ?? new Date(now.getTime() - windowMs);

    if (admin.digestLastSentAt && now.getTime() - admin.digestLastSentAt.getTime() < windowMs) {
      continue;
    }

    const newUsers = await prisma.user.findMany({
      where: { createdAt: { gt: since } },
      select: { email: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    if (newUsers.length > 0) {
      const itemsHtml = newUsers
        .map(
          (user) =>
            `<li>${user.name ? `${escapeHtml(user.name)} (${escapeHtml(user.email)})` : escapeHtml(user.email)}</li>`,
        )
        .join("");
      await sendEmail({
        to: admin.email,
        subject: `After Atlas: ${newUsers.length} new signup${newUsers.length === 1 ? "" : "s"} (${frequency} digest)`,
        html: `<p>${newUsers.length} new user${newUsers.length === 1 ? "" : "s"} signed up:</p><ul>${itemsHtml}</ul>`,
      });
      digestsSent += 1;
    }

    await prisma.user.update({ where: { id: admin.id }, data: { digestLastSentAt: now } });
  }

  return NextResponse.json({ ok: true, digestsSent });
}
