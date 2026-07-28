import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Thin wrapper so callers don't each need to check for a configured
 * provider. Without RESEND_API_KEY set (e.g. local dev), this logs instead
 * of sending — mirrors how the Yelp integration falls back gracefully
 * without an API key rather than crashing the app.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
    return;
  }

  const from = process.env.EMAIL_FROM ?? "After Atlas <onboarding@resend.dev>";
  const result = await resend.emails.send({ from, to, subject, html });
  if (result.error) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, result.error);
  }
}
