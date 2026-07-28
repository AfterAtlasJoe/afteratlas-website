import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

import { ReviewedToggle } from "./reviewed-toggle";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fadmin%2Ffeedback");
  }
  if (!(await isAdminUser(session.user.id))) {
    notFound();
  }

  const feedback = await prisma.feedback.findMany({
    include: {
      user: { select: { email: true } },
      surveyResponse: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/admin" className="text-sm underline">
          ← Back to admin report
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Feedback</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {feedback.length} submission{feedback.length === 1 ? "" : "s"} total.
        </p>
      </div>

      {feedback.length === 0 ? (
        <p className="text-sm text-zinc-500">No feedback yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {feedback.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-zinc-500">
                  {item.user?.email ?? item.email ?? "Anonymous"} ·{" "}
                  {item.createdAt.toLocaleString()}
                  {item.page ? ` · ${item.page}` : ""}
                  {item.ipAddress ? ` · ${item.ipAddress}` : ""}
                  {item.surveyResponse ? (
                    <>
                      {" · "}
                      <Link
                        href={`/checklist/${item.surveyResponse.id}`}
                        className="underline"
                      >
                        {item.surveyResponse.title ?? "their checklist"}
                      </Link>
                    </>
                  ) : null}
                </p>
                <ReviewedToggle id={item.id} reviewed={Boolean(item.reviewedAt)} />
              </div>
              <p className="whitespace-pre-line text-sm">{item.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
