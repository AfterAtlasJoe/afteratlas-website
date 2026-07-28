import { auth } from "@/auth";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ surveyResponseId?: string; from?: string }>;
}) {
  const session = await auth();
  const { surveyResponseId, from } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tell us what&apos;s working or what isn&apos;t — we read every submission.
        </p>
      </div>
      <FeedbackForm
        isSignedIn={Boolean(session?.user)}
        surveyResponseId={surveyResponseId}
        page={from ?? "feedback_page"}
      />
    </div>
  );
}
