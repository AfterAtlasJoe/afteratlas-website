import { escapeHtml } from "@/lib/html";

/** The email sent to a user when a survey they own transitions to completed. */
export function buildChecklistEmail({
  recipientName,
  checklistTitle,
  itemTitles,
  checklistUrl,
  pdfUrl,
}: {
  recipientName: string | null;
  checklistTitle: string;
  itemTitles: string[];
  checklistUrl: string;
  pdfUrl: string;
}): { subject: string; html: string } {
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : "Hi,";
  const itemsHtml = itemTitles.length
    ? `<ul>${itemTitles.map((title) => `<li>${escapeHtml(title)}</li>`).join("")}</ul>`
    : "<p>No checklist items were triggered by your answers.</p>";

  return {
    subject: `Your checklist is ready: ${checklistTitle}`,
    html: `
      <p>${greeting}</p>
      <p>Your checklist &ldquo;${escapeHtml(checklistTitle)}&rdquo; is ready. Here's what's on it:</p>
      ${itemsHtml}
      <p>
        <a href="${checklistUrl}">View your checklist online</a>
        or
        <a href="${pdfUrl}">download it as a PDF</a>.
      </p>
      <p style="color:#71717a;font-size:12px;">
        You're receiving this because you completed a survey on After Atlas.
        You can turn this off anytime from your profile settings.
      </p>
    `,
  };
}
