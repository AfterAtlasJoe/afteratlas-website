import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/html";
import { prisma } from "@/lib/prisma";

/**
 * Called right after a new User row is created, from both signup paths:
 * email/password (src/app/api/register/route.ts) and OAuth (the
 * events.createUser callback in src/auth.ts). Only admins set to "instant"
 * get emailed here — daily/weekly/monthly admins are covered by the digest
 * cron instead (src/app/api/cron/admin-digest/route.ts), which reads the
 * same new-user rows via createdAt rather than needing this call to know
 * about them.
 */
export async function notifyAdminsOfNewSignup(newUser: {
  email: string;
  name?: string | null;
}): Promise<void> {
  const instantAdmins = await prisma.user.findMany({
    where: { isAdmin: true, adminDigestFrequency: "instant" },
    select: { email: true },
  });

  const who = newUser.name
    ? `${escapeHtml(newUser.name)} (${escapeHtml(newUser.email)})`
    : escapeHtml(newUser.email);

  await Promise.all(
    instantAdmins.map((admin) =>
      sendEmail({
        to: admin.email,
        subject: "New After Atlas signup",
        html: `<p>A new user just signed up: ${who}.</p>`,
      }).catch((error) => console.error("Failed to send new-signup admin alert:", error)),
    ),
  );
}
