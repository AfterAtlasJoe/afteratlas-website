/**
 * Shown at registration (as a required checkbox) and on /disclaimer (for
 * accounts created before this existed). Plain, standard "not a
 * substitute for professional advice" language — not reviewed by a
 * lawyer; treat as a starting point, not a final liability waiver.
 *
 * Kept in its own module (no server-only imports) so client components
 * like the registration form can render it without pulling Prisma/pg
 * into the browser bundle.
 */
export const DISCLAIMER_TEXT = `After Atlas is an organizational and informational tool only. It helps you keep track of tasks and general information after a death or during your own planning — it is not a substitute for professional legal, financial, tax, or medical advice, and using it does not create an attorney-client, financial-advisory, or any other professional relationship with After Atlas or its creators.

Laws and requirements vary by state and change over time. Before making any decisions based on information in this app, you should consult a licensed attorney, financial advisor, or other qualified professional in your jurisdiction.

By continuing, you acknowledge that After Atlas and its creators are not liable for actions taken, or not taken, based on information provided in this app.`;
