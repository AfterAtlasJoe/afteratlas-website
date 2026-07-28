/**
 * Thin wrapper over the Yelp Fusion Business Search API, used to show real
 * vendor listings instead of the static Vendor/VendorCategory table (which
 * only ever held illustrative sample rows). Server-only — YELP_API_KEY must
 * never reach the client bundle.
 */

export type YelpBusiness = {
  id: string;
  name: string;
  url: string;
  rating: number;
  reviewCount: number;
  price: string | null;
  imageUrl: string | null;
  address: string;
};

type YelpApiBusiness = {
  id: string;
  name: string;
  url: string;
  rating: number;
  review_count: number;
  price?: string;
  image_url?: string;
  location?: { display_address?: string[] };
};

/**
 * How many candidates to pull from Yelp before sorting locally and
 * trimming to the caller's `limit`. Yelp's own `sort_by=rating` skews
 * toward businesses with only one or two reviews, so instead we fetch a
 * wider best-match pool and rank it ourselves (rating, then review count
 * as the tiebreaker) rather than trusting Yelp's ordering directly.
 */
const CANDIDATE_POOL_SIZE = 20;

/**
 * Looks up vendors near `zipCode` matching `term` (e.g. a VendorCategory
 * name like "Funeral Homes"). Returns an empty list rather than throwing on
 * any failure (missing key, bad zip, rate limit, network error) — callers
 * fall back to a plain "search Yelp yourself" link when the list is empty.
 * Results are sorted by highest rating first, with review count as a
 * tiebreaker.
 */
export async function searchYelpBusinesses(
  term: string,
  zipCode: string | null | undefined,
  limit = 3,
): Promise<YelpBusiness[]> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey || !zipCode) return [];

  const url = new URL("https://api.yelp.com/v3/businesses/search");
  url.searchParams.set("term", term);
  url.searchParams.set("location", zipCode);
  url.searchParams.set("limit", String(Math.max(limit, CANDIDATE_POOL_SIZE)));

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];

    const data: { businesses?: YelpApiBusiness[] } = await response.json();
    const businesses = (data.businesses ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      url: b.url,
      rating: b.rating,
      reviewCount: b.review_count,
      price: b.price ?? null,
      imageUrl: b.image_url ?? null,
      address: b.location?.display_address?.join(", ") ?? "",
    }));
    businesses.sort(
      (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
    );
    return businesses.slice(0, limit);
  } catch {
    return [];
  }
}
