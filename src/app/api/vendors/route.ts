import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchYelpBusinesses } from "@/lib/yelp";

/**
 * On-demand Yelp lookup for vendor recommendations shown inline on a
 * survey question (as opposed to the checklist/gaps pages, which fetch
 * server-side since they're rendered fresh per navigation). The survey
 * itself advances via client-side state without a full page reload, so
 * those inline recommendations need a route to call as each question
 * appears.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categorySlug = request.nextUrl.searchParams.get("category");
  const zip = request.nextUrl.searchParams.get("zip");
  if (!categorySlug) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  const category = await prisma.vendorCategory.findUnique({
    where: { slug: categorySlug },
  });
  if (!category) {
    return NextResponse.json({ error: "Unknown category" }, { status: 404 });
  }

  const businesses = await searchYelpBusinesses(category.yelpSearchTerm, zip);
  return NextResponse.json({ businesses });
}
