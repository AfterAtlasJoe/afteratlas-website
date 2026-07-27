import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  groupByCategory,
  resolveTriggeredItems,
  type SurveyAnswers,
} from "@/lib/survey-engine";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11 },
  title: { fontSize: 18, marginBottom: 16 },
  category: { fontSize: 14, marginTop: 16, marginBottom: 8 },
  itemTitle: { fontSize: 12, marginBottom: 2 },
  itemDescription: { marginBottom: 8, color: "#444" },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ responseId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { responseId } = await params;
  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: { eventType: true },
  });
  if (
    !response ||
    response.userId !== session.user.id ||
    response.mode !== "post_event"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const checklistItems = await prisma.checklistItem.findMany({
    where: { eventTypeId: response.eventTypeId },
    include: { triggers: { select: { questionId: true, answerOptionId: true } } },
  });
  const triggered = resolveTriggeredItems(
    checklistItems,
    (response.answers as SurveyAnswers) ?? {},
  );
  const grouped = groupByCategory(triggered);

  const buffer = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{response.eventType.name} checklist</Text>
        {Array.from(grouped.entries()).map(([category, items]) => (
          <View key={category}>
            <Text style={styles.category}>{category}</Text>
            {items.map((item) => (
              <View key={item.id}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${response.eventType.id}-checklist.pdf"`,
    },
  });
}
