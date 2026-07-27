import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireDisclaimerAccepted } from "@/lib/disclaimer";
import { SurveyResponseCard } from "@/components/dashboard/survey-response-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fdashboard");
  }
  await requireDisclaimerAccepted(session.user.id, "/dashboard");

  const responses = await prisma.surveyResponse.findMany({
    where: { userId: session.user.id },
    include: { eventType: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">
          {session.user.name ?? session.user.email}
        </h1>
        <p className="text-sm text-zinc-500">{session.user.email}</p>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">Your surveys</h2>
        {responses.length === 0 ? (
          <p className="text-sm text-zinc-500">
            You haven&apos;t started a survey yet.{" "}
            <Link href="/" className="underline">
              Get started
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {responses.map((response) => {
              const resultsPath =
                response.mode === "post_event" ? "checklist" : "gaps";
              const resumePath =
                response.mode === "post_event" ? "survey" : "plan";
              const href =
                response.status === "completed"
                  ? `/${resultsPath}/${response.id}`
                  : `/${resumePath}/${response.eventTypeId}`;
              return (
                <SurveyResponseCard
                  key={response.id}
                  id={response.id}
                  title={response.title ?? response.eventType.name}
                  subtitle={`${
                    response.mode === "post_event"
                      ? "Post-event checklist"
                      : "Planning gap report"
                  } · ${response.status.replace("_", " ")}`}
                  createdAt={response.createdAt.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  href={href}
                  actionLabel={response.status === "completed" ? "View" : "Resume"}
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
