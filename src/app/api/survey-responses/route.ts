import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createSurveyResponse } from "@/lib/survey-responses";
import type { SurveyMode } from "@/generated/prisma/client";

/** Starts a new, user-named SurveyResponse. Mode-agnostic: backs both /survey and /plan. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const eventTypeId: string | undefined = body.eventTypeId;
  const mode: SurveyMode | undefined = body.mode;
  const title: string | undefined = body.title;
  const zipCode: string | undefined = body.zipCode;
  if (!eventTypeId || !mode || !title || !zipCode) {
    return NextResponse.json(
      { error: "eventTypeId, mode, title, and zipCode are required" },
      { status: 400 },
    );
  }

  const created = await createSurveyResponse(
    session.user.id,
    eventTypeId,
    mode,
    title,
    zipCode,
  );

  return NextResponse.json(created);
}
