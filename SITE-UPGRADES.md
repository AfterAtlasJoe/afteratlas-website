# Site upgrade checklist

Longer-term technical-debt items — things that work today via a manual or
one-off fix, but deserve a proper solution eventually rather than repeating
the workaround.

## Open

- **Automatic migrations + seeding on deploy.** Right now, schema
  migrations and re-running `prisma/seed.ts` against production only
  happen when manually triggered (most recently via a one-time,
  since-deleted `/api/admin/run-seed` route). The standard fix is to run
  `prisma migrate deploy` as part of Vercel's build step (e.g. change the
  build command to `prisma migrate deploy && next build`, or a
  `vercel-build` package.json script) so schema changes apply
  automatically on every deploy. Re-seeding content (blog articles,
  checklist items, survey questions) is a separate question — it may be
  worth a small internal "admin: re-seed" button gated behind the existing
  admin auth instead of full automation, since seeding is a content
  operation, not a schema one, and shouldn't necessarily run on every
  deploy.
