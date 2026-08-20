import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    // The one-time /api/admin/run-seed route (see its own doc comment)
    // imports prisma/seed-json.ts and prisma/seed-xlsx.ts directly, both
    // of which read their source data off disk at runtime (readdirSync
    // over prisma/seed-data/*.json, XLSX.readFile on the spreadsheet) —
    // dynamic fs reads Next's automatic tracing doesn't reliably catch,
    // unlike the plain `import` graph itself. Remove this entry along
    // with the route once the one-time run is done.
    "/api/admin/run-seed": [
      "./prisma/seed-data/**/*.json",
      "./After_Atlas_July26 2026_Claude updated.xlsx",
    ],
  },
};

export default nextConfig;
