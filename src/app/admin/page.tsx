import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { addAdmin, removeAdmin } from "@/app/admin/actions";
import { auth } from "@/auth";
import { AdminManagement } from "@/components/admin/admin-management";
import { isAdminUser } from "@/lib/admin";
import { computeAdminAnalytics } from "@/lib/admin-analytics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

/** A plain table — no charting library, this is read by one person occasionally, not a public dashboard. */
function StatTable({
  title,
  rows,
  labelHeader,
}: {
  title: string;
  rows: { label: string; count: number }[];
  labelHeader: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No data yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-zinc-500 dark:border-white/10">
              <th className="py-1 font-normal">{labelHeader}</th>
              <th className="py-1 font-normal">Count</th>
              <th className="py-1 font-normal">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-black/5 dark:border-white/5">
                <td className="py-1.5 pr-4">{row.label}</td>
                <td className="py-1.5 pr-4">{row.count}</td>
                <td className="py-1.5 text-zinc-500">
                  {total === 0 ? "—" : formatPercent(row.count / total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fadmin");
  }
  if (!(await isAdminUser(session.user.id))) {
    notFound();
  }

  const [responses, questions, checklistItems, admins, unreviewedFeedbackCount] =
    await Promise.all([
      prisma.surveyResponse.findMany({
        select: {
          id: true,
          status: true,
          mode: true,
          zipCode: true,
          answers: true,
          selectedCategories: true,
          lastQuestionId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.question.findMany({ select: { id: true, category: true } }),
      prisma.checklistItem.findMany({
        select: {
          id: true,
          title: true,
          triggers: { select: { questionId: true, answerOptionId: true } },
        },
      }),
      prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true, email: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.feedback.count({ where: { reviewedAt: null } }),
    ]);

  const stats = computeAdminAnalytics(responses, questions, checklistItems);
  const recentDays = stats.responsesPerDay.slice(-14);
  const maxDayCount = Math.max(1, ...recentDays.map((d) => d.count));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin report</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Built from survey response data already on file — see the note at
            the bottom for what this doesn&apos;t cover.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/admin/users"
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/10"
          >
            Users
          </Link>
          <Link
            href="/admin/feedback"
            className="rounded-full border border-accent bg-accent-light px-4 py-2 text-sm font-medium text-accent-ink"
          >
            Feedback
            {unreviewedFeedbackCount > 0 ? ` (${unreviewedFeedbackCount})` : ""}
          </Link>
        </div>
      </div>

      <AdminManagement
        admins={admins}
        currentUserId={session.user.id}
        addAdminAction={addAdmin}
        removeAdminAction={removeAdmin}
      />

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {[
          { label: "Surveys started", value: String(stats.totalResponses) },
          { label: "Completed", value: String(stats.completedResponses) },
          { label: "Completion rate", value: formatPercent(stats.completionRate) },
          {
            label: "Avg. questions answered",
            value: stats.avgQuestionsAnswered.toFixed(1),
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-black/10 p-4 dark:border-white/10"
          >
            <p className="text-xs text-zinc-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <p className="text-xs text-zinc-500">Avg. time to complete</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatMinutes(stats.avgMinutesToComplete)}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-medium">Surveys started, last 14 days</h2>
        {recentDays.length === 0 ? (
          <p className="text-sm text-zinc-500">No data yet.</p>
        ) : (
          <div className="flex h-32 items-end gap-1">
            {recentDays.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-accent"
                  style={{ height: `${(day.count / maxDayCount) * 100}%`, minHeight: 2 }}
                  title={`${day.date}: ${day.count}`}
                />
                <span className="text-[10px] text-zinc-500">{day.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <StatTable
        title="Where people get stuck (in-progress responses, by section)"
        labelHeader="Category"
        rows={stats.abandonmentByCategory.map((r) => ({ label: r.category, count: r.count }))}
      />

      <StatTable
        title="Most-selected topics"
        labelHeader="Category"
        rows={stats.categoryPopularity.map((r) => ({ label: r.category, count: r.count }))}
      />

      <StatTable
        title="Most-triggered checklist items"
        labelHeader="Item"
        rows={stats.topChecklistItems.map((r) => ({ label: r.title, count: r.count }))}
      />

      <StatTable
        title="Most-entered zip codes"
        labelHeader="Zip code"
        rows={stats.topZipCodes.map((r) => ({ label: r.zipCode, count: r.count }))}
      />

      <div className="grid gap-8 sm:grid-cols-2">
        <StatTable
          title="Jurisdiction"
          labelHeader="Jurisdiction"
          rows={stats.jurisdictionSplit.map((r) => ({
            label: r.jurisdiction === "wa" ? "Washington" : "Other / general",
            count: r.count,
          }))}
        />
        <StatTable
          title="Mode"
          labelHeader="Mode"
          rows={stats.modeSplit.map((r) => ({
            label: r.mode === "post_event" ? "Post-event checklist" : "Planning",
            count: r.count,
          }))}
        />
      </div>

      <div className="rounded-lg border border-black/10 p-4 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">
          What this doesn&apos;t cover
        </p>
        <p className="mt-2">
          Everything above is built from responses that at least started a
          survey — it has no visibility into visits that never got that far
          (raw traffic, bounce rate, referrers). That&apos;s a separate tool:
          check{" "}
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            your project&apos;s Analytics tab in the Vercel dashboard
          </a>{" "}
          for that side of things — Vercel doesn&apos;t currently expose that
          data through an API this page could pull in directly, so the two
          live side by side rather than in one combined view.
        </p>
        <p className="mt-2">
          &ldquo;Avg. time to complete&rdquo; is wall-clock time between
          starting and finishing, not active time spent — someone who starts,
          leaves for two days, then finishes in ten minutes still counts as
          roughly two days. Zip codes are self-entered for vendor search, not
          detected from IP address.
        </p>
      </div>
    </div>
  );
}
