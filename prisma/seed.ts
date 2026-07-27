import "dotenv/config";

import { seedJson } from "./seed-json";
import { seedXlsx } from "./seed-xlsx";

/**
 * Single entry point for `prisma db seed`. Prisma's seed runner spawns the
 * configured command directly (no shell), so a command like
 * `tsx a.ts && tsx b.ts` doesn't chain two scripts — `&&` and everything
 * after it get passed as literal, ignored argv to the first script, and
 * only that one ever runs. Importing and awaiting both here in one process
 * is what actually runs them in sequence.
 */
async function main() {
  await seedJson();
  await seedXlsx();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
