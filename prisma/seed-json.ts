import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient, type SurveyMode } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Generic seed loader: reads every prisma/seed-data/*.json file and upserts
 * its contents. Adding divorce.json / layoff.json later requires no changes
 * here — this script never branches on event type. Called from
 * prisma/seed.ts (the single entry point Prisma's seed runner invokes —
 * it doesn't run the configured command through a shell, so chaining two
 * scripts with `&&` silently only runs the first one).
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type SeedAnswerOption = { id: string; label: string; value: string; order: number };
type SeedQuestion = {
  id: string;
  mode: SurveyMode;
  category: string;
  section: string | null;
  order: number;
  prompt: string;
  answerOptions: SeedAnswerOption[];
};
type SeedBranch = {
  questionId: string;
  answerOptionId: string;
  nextQuestionId: string | null;
  skipQuestionIds: string[];
};
type SeedTrigger = { questionId: string; answerOptionId: string };
type SeedChecklistItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  relatedLinks: string[];
  vendorCategoryId: string | null;
  triggers: SeedTrigger[];
};
type SeedGap = {
  id: string;
  title: string;
  description: string;
  category: string;
  vendorCategoryId: string | null;
  triggers: SeedTrigger[];
};
type SeedVendorCategory = {
  id: string;
  slug: string;
  name: string;
  singularName: string;
  yelpSearchTerm: string;
  description?: string;
};
type SeedVendor = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  priceRange?: string;
  vendorCategoryId: string;
  zipCodes: string[];
  serviceAreaDescription?: string;
  websiteUrl: string;
  reviewSourceUrl?: string;
  priority: number;
};
type SeedArticle = {
  slug: string;
  title: string;
  body: string;
  metaTitle?: string;
  metaDescription?: string;
  publishedAt: string | null;
  eventTypeId: string | null;
};

type SeedFile = {
  eventType: { id: string; name: string; description: string; active: boolean };
  vendorCategories: SeedVendorCategory[];
  vendors: SeedVendor[];
  questions: SeedQuestion[];
  branches: SeedBranch[];
  checklistItems: SeedChecklistItem[];
  gaps: SeedGap[];
  articles: SeedArticle[];
};

async function seedFile(seed: SeedFile) {
  console.log(`Seeding event type: ${seed.eventType.id}`);

  await prisma.eventType.upsert({
    where: { id: seed.eventType.id },
    create: seed.eventType,
    update: seed.eventType,
  });

  for (const category of seed.vendorCategories) {
    await prisma.vendorCategory.upsert({
      where: { id: category.id },
      create: category,
      update: category,
    });
  }

  for (const vendor of seed.vendors) {
    await prisma.vendor.upsert({
      where: { id: vendor.id },
      create: vendor,
      update: vendor,
    });
  }

  for (const question of seed.questions) {
    const { answerOptions, ...questionFields } = question;
    await prisma.question.upsert({
      where: { id: question.id },
      create: {
        ...questionFields,
        eventTypeId: seed.eventType.id,
        answerOptions: { create: answerOptions },
      },
      update: questionFields,
    });
    for (const option of answerOptions) {
      await prisma.answerOption.upsert({
        where: { id: option.id },
        create: { ...option, questionId: question.id },
        update: option,
      });
    }
  }

  for (const branch of seed.branches) {
    await prisma.questionBranch.upsert({
      where: {
        questionId_answerOptionId: {
          questionId: branch.questionId,
          answerOptionId: branch.answerOptionId,
        },
      },
      create: branch,
      update: branch,
    });
  }

  for (const item of seed.checklistItems) {
    const { triggers, ...itemFields } = item;
    await prisma.checklistItem.upsert({
      where: { id: item.id },
      create: { ...itemFields, eventTypeId: seed.eventType.id },
      update: itemFields,
    });
    for (const trigger of triggers) {
      await prisma.checklistItemTrigger.upsert({
        where: {
          checklistItemId_questionId_answerOptionId: {
            checklistItemId: item.id,
            questionId: trigger.questionId,
            answerOptionId: trigger.answerOptionId,
          },
        },
        create: { ...trigger, checklistItemId: item.id },
        update: {},
      });
    }
  }

  for (const gap of seed.gaps) {
    const { triggers, ...gapFields } = gap;
    await prisma.gap.upsert({
      where: { id: gap.id },
      create: { ...gapFields, eventTypeId: seed.eventType.id },
      update: gapFields,
    });
    for (const trigger of triggers) {
      await prisma.gapTrigger.upsert({
        where: {
          gapId_questionId_answerOptionId: {
            gapId: gap.id,
            questionId: trigger.questionId,
            answerOptionId: trigger.answerOptionId,
          },
        },
        create: { ...trigger, gapId: gap.id },
        update: {},
      });
    }
  }

  for (const article of seed.articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      create: {
        ...article,
        publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
      },
      update: {
        ...article,
        publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
      },
    });
  }
}

export async function seedJson() {
  // process.cwd() rather than import.meta.dirname — the latter evaluates to
  // undefined once this module is bundled through Next.js's route-handler
  // pipeline (see src/app/api/admin/run-seed/route.ts), even though it
  // works fine run standalone via tsx. Both resolve to the repo root when
  // invoked from there, which is how this runs either way.
  const seedDataDir = join(process.cwd(), "prisma", "seed-data");
  const files = readdirSync(seedDataDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const contents = readFileSync(join(seedDataDir, file), "utf-8");
    await seedFile(JSON.parse(contents) as SeedFile);
  }

  await prisma.$disconnect();
}
