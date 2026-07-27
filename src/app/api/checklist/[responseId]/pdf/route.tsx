import { Document, Link, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  groupByCategory,
  resolveTriggeredItems,
  type SurveyAnswers,
} from "@/lib/survey-engine";
import { searchYelpBusinesses, type YelpBusiness } from "@/lib/yelp";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11 },
  title: { fontSize: 18, marginBottom: 4 },
  subtitle: { color: "#666", marginBottom: 16 },
  category: { fontSize: 14, marginTop: 16, marginBottom: 8 },
  item: { marginBottom: 12 },
  itemTitle: { fontSize: 12, marginBottom: 2 },
  itemDescription: { marginBottom: 4, color: "#444" },
  link: { color: "#2563eb", textDecoration: "underline", marginBottom: 2 },
  vendorBox: { marginTop: 4, padding: 8, backgroundColor: "#f5f5f5" },
  vendorHeading: { marginBottom: 4, fontWeight: 700 },
  vendorMeta: { color: "#666", fontSize: 9, marginBottom: 4 },
});

function VendorSection({
  categoryName,
  businesses,
}: {
  categoryName: string;
  businesses: YelpBusiness[];
}) {
  return (
    <View style={styles.vendorBox}>
      <Text style={styles.vendorHeading}>Need a {categoryName.toLowerCase()}?</Text>
      {businesses.length === 0 ? (
        <Link
          style={styles.link}
          src={`https://www.yelp.com/search?find_desc=${encodeURIComponent(categoryName)}`}
        >
          Search Yelp for {categoryName}
        </Link>
      ) : (
        businesses.map((business) => (
          <View key={business.id} style={{ marginBottom: 6 }}>
            <Link style={styles.link} src={business.url}>
              {business.name}
            </Link>
            <Text style={styles.vendorMeta}>
              {business.rating}★ ({business.reviewCount} reviews)
              {business.price ? ` · ${business.price}` : ""}
              {business.address ? ` · ${business.address}` : ""}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

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
    include: {
      triggers: { select: { questionId: true, answerOptionId: true } },
      vendorCategory: true,
    },
  });
  const triggered = resolveTriggeredItems(
    checklistItems,
    (response.answers as SurveyAnswers) ?? {},
  );
  const grouped = groupByCategory(triggered);

  const vendorCategories = new Map(
    triggered
      .map((item) => item.vendorCategory)
      .filter((category) => category !== null)
      .map((category) => [category.id, category]),
  );
  const vendorResultsByCategoryId = new Map(
    await Promise.all(
      Array.from(vendorCategories.values()).map(async (category) => {
        const businesses = await searchYelpBusinesses(category.name, response.zipCode);
        return [category.id, businesses] as const;
      }),
    ),
  );

  const buffer = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          {response.title ?? `${response.eventType.name} checklist`}
        </Text>
        <Text style={styles.subtitle}>
          {triggered.length} task{triggered.length === 1 ? "" : "s"} based on your answers.
        </Text>
        {Array.from(grouped.entries()).map(([category, items]) => (
          <View key={category}>
            <Text style={styles.category}>{category}</Text>
            {items.map((item) => (
              <View key={item.id} style={styles.item}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
                {item.relatedLinks.map((url) => (
                  <Link key={url} style={styles.link} src={url}>
                    {url}
                  </Link>
                ))}
                {item.vendorCategory ? (
                  <VendorSection
                    categoryName={item.vendorCategory.name}
                    businesses={vendorResultsByCategoryId.get(item.vendorCategory.id) ?? []}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ))}
        {triggered.length === 0 ? (
          <Text>No checklist items were triggered by your answers yet.</Text>
        ) : null}
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
