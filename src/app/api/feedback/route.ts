import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";

const MAX_MESSAGE_LENGTH = 5000;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const message: string | undefined = body.message?.trim();
  const email: string | undefined = body.email?.trim() || undefined;
  const surveyResponseId: string | undefined = body.surveyResponseId || undefined;
  const page: string | undefined = body.page || undefined;

  // Honeypot: a field named to tempt form-filling bots, hidden from real
  // visitors via CSS rather than `display:none` (which some bots skip
  // over). Any value here means it wasn't a human — pretend success so the
  // bot doesn't learn to look for another field, but don't write anything.
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (!message) {
    return NextResponse.json({ error: "Feedback message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Feedback must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const ipAddress = getClientIp(request);
  if (ipAddress) {
    const recentCount = await prisma.feedback.count({
      where: {
        ipAddress,
        createdAt: { gt: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });
    if (recentCount >= RATE_LIMIT_MAX_SUBMISSIONS) {
      return NextResponse.json(
        { error: "Too many submissions from this connection. Please try again later." },
        { status: 429 },
      );
    }
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
      ipAddress: ipAddress ?? undefined,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
