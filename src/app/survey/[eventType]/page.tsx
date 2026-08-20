import { SurveyPage } from "@/components/survey/survey-page";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ eventType: string }>;
  searchParams: Promise<{ disclaimerAck?: string }>;
}) {
  const { eventType } = await params;
  const { disclaimerAck } = await searchParams;
  return (
    <SurveyPage
      eventTypeId={eventType}
      mode="post_event"
      resultsBasePath="/checklist"
      loginCallbackBasePath="/survey"
      disclaimerAcknowledged={disclaimerAck === "1"}
    />
  );
}
