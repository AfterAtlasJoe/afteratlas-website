import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VendorsPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  const vendorCategory = await prisma.vendorCategory.findUnique({
    where: { slug: category },
    include: { vendors: { orderBy: { priority: "desc" } } },
  });
  if (!vendorCategory) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">{vendorCategory.name}</h1>
        {vendorCategory.description ? (
          <p className="text-sm text-zinc-500">{vendorCategory.description}</p>
        ) : null}
      </div>

      {vendorCategory.vendors.length === 0 ? (
        <a
          href={`https://www.yelp.com/search?find_desc=${encodeURIComponent(
            vendorCategory.name,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Search Yelp for {vendorCategory.name}
        </a>
      ) : (
        <ul className="flex flex-col gap-4">
          {vendorCategory.vendors.map((vendor) => (
            <li
              key={vendor.id}
              className="flex flex-col gap-1 rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <h2 className="font-medium">{vendor.name}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {vendor.description}
              </p>
              {vendor.priceRange ? (
                <p className="text-xs text-zinc-500">{vendor.priceRange}</p>
              ) : null}
              <a
                href={vendor.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-sm underline"
              >
                Visit website
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
