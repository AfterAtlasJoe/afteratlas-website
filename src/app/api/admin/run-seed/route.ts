import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { seedJson } from "../../../../../prisma/seed-json";
import { seedXlsx } from "../../../../../prisma/seed-xlsx";

/**
 * ONE-TIME ROUTE — delete this file (and its next.config.ts
 * outputFileTracingIncludes entry) once it's been run successfully once
 * in production. See the site-upgrade checklist for the proper long-term
 * fix (an automatic migrate+seed step in the deploy pipeline instead of
 * this manual trigger).
 *
 * Catches production up on schema + seed-data changes made this session
 * that were never applied outside local dev: the two small Article
 * columns from migration 20260731043244 (run as idempotent raw SQL here
 * rather than shelling out to `prisma migrate deploy`, which isn't
 * reliably available inside a Vercel serverless function), the stale
 * placeholder-article delete from migration 20260731044326, and then the
 * real seedJson()/seedXlsx() functions — the exact same ones `prisma db
 * seed` runs locally — so production ends up in the same state as this
 * dev environment rather than a hand-picked subset of it. Everything here
 * is upsert-based and safe to run more than once.
 *
 * GET (not POST) specifically so triggering it is just visiting the URL
 * while signed in as an admin — no dev tools/terminal needed on the
 * visitor's end.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$executeRawUnsafe(
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT',
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT',
  );
  await prisma.$executeRawUnsafe(
    "DELETE FROM \"articles\" WHERE \"slug\" = 'what-to-do-in-the-first-48-hours'",
  );

  await seedJson();
  await seedXlsx();

  return NextResponse.json({ ok: true });
}
