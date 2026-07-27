import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { searchYelpBusinesses } from "@/lib/yelp";
import { VendorRecommendations } from "@/components/vendors/vendor-recommendations";

export const dynamic = "force-dynamic";

export default async function VendorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ zip?: string }>;
}) {
  const { category } = await params;
  const { zip } = await searchParams;

  const vendorCategory = await prisma.vendorCategory.findUnique({
    where: { slug: category },
  });
  if (!vendorCategory) {
    notFound();
  }

  const businesses = await searchYelpBusinesses(vendorCategory.name, zip);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">{vendorCategory.name}</h1>
        {vendorCategory.description ? (
          <p className="text-sm text-zinc-500">{vendorCategory.description}</p>
        ) : null}
      </div>

      <VendorRecommendations
        categoryName={vendorCategory.name}
        businesses={businesses}
      />
    </div>
  );
}
