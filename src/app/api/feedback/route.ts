import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_MESSAGE_LENGTH = 5000;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const message: string | undefined = body.message?.trim();
  const email: string | undefined = body.email?.trim() || undefined;
  const surveyResponseId: string | undefined = body.surveyResponseId || undefined;
  const page: string | undefined = body.page || undefined;

  if (!message) {
    return NextResponse.json({ error: "Feedback message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Feedback must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const session = await auth();

  // A surveyResponseId is client-supplied context, not an access grant — only
  // attach it if it actually belongs to the submitter (or drop it silently
  // for an anonymous submitter, rather than trusting an arbitrary id).
  let verifiedSurveyResponseId: string | undefined;
  if (surveyResponseId && session?.user?.id) {
    const owned = await prisma.surveyResponse.findFirst({
      where: { id: surveyResponseId, userId: session.user.id },
      select: { id: true },
    });
    verifiedSurveyResponseId = owned?.id;
  }

  await prisma.feedback.create({
    data: {
      message,
      email: session?.user?.id ? undefined : email,
      userId: session?.user?.id ?? undefined,
      surveyResponseId: verifiedSurveyResponseId,
      page,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
