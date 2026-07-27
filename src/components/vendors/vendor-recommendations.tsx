import type { YelpBusiness } from "@/lib/yelp";

type VendorRecommendationsProps = {
  categoryName: string;
  /** What actually goes in the fallback search link's query — defaults to categoryName if omitted. Pass VendorCategory.yelpSearchTerm here when available; the plain display name doesn't always match how Yelp categorizes these businesses. */
  searchTerm?: string;
  businesses: YelpBusiness[];
};

/** Renders live Yelp results for a vendor category, falling back to a plain search link when there's no zip code on file or Yelp returned nothing. */
export function VendorRecommendations({
  categoryName,
  searchTerm,
  businesses,
}: VendorRecommendationsProps) {
  if (businesses.length === 0) {
    return (
      <a
        href={`https://www.yelp.com/search?find_desc=${encodeURIComponent(searchTerm ?? categoryName)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Search Yelp for {categoryName}
      </a>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {businesses.map((business) => (
        <li key={business.id} className="flex flex-col gap-0.5">
          <a
            href={business.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            {business.name}
          </a>
          <p className="text-xs text-zinc-500">
            {business.rating}★ ({business.reviewCount} reviews)
            {business.price ? ` · ${business.price}` : ""}
            {business.address ? ` · ${business.address}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
