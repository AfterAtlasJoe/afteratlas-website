import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

import { UserRowActions } from "./user-row-actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type SortKey = "firstName" | "lastName" | "email" | "createdAt" | "checklistCount";

/**
 * There's no separate firstName/lastName column — `User.name` is a single
 * free-text field from signup (and from Google's profile name for OAuth
 * accounts) — so these are a best-effort split (first word / everything
 * else) purely for this table's display and sort, not a real data model
 * change.
 */
const SORT_COLUMNS: Record<SortKey, Prisma.Sql> = {
  firstName: Prisma.sql`split_part(u."name", ' ', 1)`,
  lastName: Prisma.sql`NULLIF(substring(u."name" from position(' ' in u."name") + 1), '')`,
  email: Prisma.sql`u.email`,
  createdAt: Prisma.sql`u."createdAt"`,
  checklistCount: Prisma.sql`"checklistCount"`,
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "createdAt", label: "Registered" },
  { key: "checklistCount", label: "Checklists" },
];

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  isAdmin: boolean;
  checklistCount: number;
};

function isSortKey(value: string | undefined): value is SortKey {
  return !!value && value in SORT_COLUMNS;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; dir?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fadmin%2Fusers");
  }
  if (!(await isAdminUser(session.user.id))) {
    notFound();
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sortKey: SortKey = isSortKey(params.sort) ? params.sort : "createdAt";
  const ascending = params.dir === "asc";
  const dirSql = ascending ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const q = (params.q ?? "").trim();

  const whereClause = q
    ? Prisma.sql`WHERE u.email ILIKE ${`%${q}%`} OR u."name" ILIKE ${`%${q}%`}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<UserRow[]>(Prisma.sql`
    SELECT
      u.id,
      u.email,
      u."name",
      u."createdAt",
      u."isAdmin",
      COUNT(sr.id)::int AS "checklistCount"
    FROM users u
    LEFT JOIN survey_responses sr ON sr."userId" = u.id
    ${whereClause}
    GROUP BY u.id
    ORDER BY ${SORT_COLUMNS[sortKey]} ${dirSql} NULLS LAST, u.id ASC
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `);

  const [{ count: totalCount }] = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM users u ${whereClause}
  `);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  function pageUrl(overrides: { page?: number; sort?: SortKey; dir?: "asc" | "desc" }): string {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("sort", overrides.sort ?? sortKey);
    next.set("dir", overrides.dir ?? (ascending ? "asc" : "desc"));
    next.set("page", String(overrides.page ?? page));
    return `/admin/users?${next.toString()}`;
  }

  function sortHeaderHref(key: SortKey): string {
    const nextDir = sortKey === key && ascending ? "desc" : "asc";
    return pageUrl({ sort: key, dir: nextDir, page: 1 });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/admin" className="text-sm underline">
          ← Back to admin report
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {totalCount} user{totalCount === 1 ? "" : "s"} total.
        </p>
      </div>

      <form action="/admin/users" method="get" className="flex gap-2">
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={ascending ? "asc" : "desc"} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="w-full max-w-sm rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
        />
        <button
          type="submit"
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/10"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-black/10 text-xs text-zinc-500 dark:border-white/10">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-3 font-medium">
                  <Link href={sortHeaderHref(column.key)} className="flex items-center gap-1 hover:underline">
                    {column.label}
                    {sortKey === column.key ? <span>{ascending ? "▲" : "▼"}</span> : null}
                  </Link>
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => {
              const spaceIndex = user.name?.indexOf(" ") ?? -1;
              const firstName = user.name
                ? spaceIndex === -1
                  ? user.name
                  : user.name.slice(0, spaceIndex)
                : "—";
              const lastName = user.name && spaceIndex !== -1 ? user.name.slice(spaceIndex + 1) : "—";

              return (
                <tr key={user.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-3">{firstName}</td>
                  <td className="px-4 py-3">{lastName}</td>
                  <td className="px-4 py-3">
                    {user.email}
                    {user.isAdmin ? (
                      <span className="ml-2 rounded-full bg-accent-light px-2 py-0.5 text-xs text-accent-ink">
                        Admin
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.createdAt.toLocaleDateString()}</td>
                  <td className="px-4 py-3">{user.checklistCount}</td>
                  <td className="px-4 py-3">
                    <UserRowActions userId={user.id} email={user.email} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-6 text-center text-zinc-500">
                  No users match that search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-500">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-3">
          {page > 1 ? (
            <Link href={pageUrl({ page: page - 1 })} className="underline">
              ← Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link href={pageUrl({ page: page + 1 })} className="underline">
              Next →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
