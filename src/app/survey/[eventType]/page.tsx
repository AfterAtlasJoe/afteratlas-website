import { SurveyPage } from "@/components/survey/survey-page";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ eventType: string }>;
}) {
  const { eventType } = await params;
  return (
    <SurveyPage
      eventTypeId={eventType}
      mode="post_event"
      resultsBasePath="/checklist"
      loginCallbackBasePath="/survey"
    />
  );
}
