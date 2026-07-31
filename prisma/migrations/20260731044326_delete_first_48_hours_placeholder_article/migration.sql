-- Data cleanup: remove the placeholder blog article now that 5 real
-- articles have been seeded. Seeding only ever upserts, so removing this
-- row from prisma/seed-data/death.json alone wouldn't remove it from any
-- database that already seeded it.
DELETE FROM "articles" WHERE "slug" = 'what-to-do-in-the-first-48-hours';
