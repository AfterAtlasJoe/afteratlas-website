/**
 * Hardcoded allowlist — there's no admin role in the data model yet (see
 * User in schema.prisma), so this is the simplest thing that works for a
 * single-operator site. If more admins are ever needed, this is the
 * obvious place to swap out for a real `User.role` column.
 */
const ADMIN_EMAILS = new Set(["codyforprez@gmail.com"]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAILS.has(email));
}
