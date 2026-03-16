const PAYLOAD_URL = "https://rvkfoodie-cms.solberg.workers.dev";

export async function payloadFetch<T>(
  endpoint: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${PAYLOAD_URL}/api/${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Payload API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// ============ TYPES ============

export interface PayloadImage {
  id: number;
  alt: string;
  url: string;
  width: number;
  height: number;
  filename: string;
}

export interface Venue {
  id: string;
  blockType: "venue";
  name: string;
  address: string;
  description: string;
  note?: string;
  time?: string;
  isFree: boolean;
  latitude?: number;
  longitude?: number;
  openingHours?: string;
  googleMapsUrl?: string;
  website?: string;
  phone?: string;
  bestOfAward?: string;
  grapevineUrl?: string;
  image?: PayloadImage;
}

export interface SectionBlock {
  id: string;
  blockType: "section";
  title: string;
  venues: Venue[];
}

export interface TextBlock {
  id: string;
  blockType: "textBlock";
  heading?: string;
  content: unknown; // Lexical JSON
  isFree: boolean;
}

export type ContentBlock = SectionBlock | TextBlock;

export interface Guide {
  id: number;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  price: number;
  gumroadProductId: string;
  gumroadUrl: string;
  googleMapsUrl?: string;
  intro?: unknown; // Lexical JSON
  content: ContentBlock[];
}

export interface Editorial {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  image?: PayloadImage;
  content: unknown; // Lexical JSON
}

export interface ChangelogEntry {
  id: number;
  date: string;
  title: string;
  description?: string;
  changeType: "added" | "removed" | "updated";
  guide?: { title: string; slug: string };
}

export interface PayloadList<T> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  page: number;
  limit: number;
}

// ============ QUERIES ============

export async function getAllGuides(): Promise<Guide[]> {
  const data = await payloadFetch<PayloadList<Guide>>("guides", {
    limit: "20",
    sort: "-price",
    depth: "2",
  });
  return data.docs;
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const data = await payloadFetch<PayloadList<Guide>>("guides", {
    "where[slug][equals]": slug,
    depth: "2",
  });
  return data.docs[0] ?? null;
}

export async function getAllEditorials(): Promise<Editorial[]> {
  const data = await payloadFetch<PayloadList<Editorial>>("editorials", {
    limit: "50",
    sort: "-date",
    depth: "1",
  });
  return data.docs;
}

export async function getEditorialBySlug(
  slug: string,
): Promise<Editorial | null> {
  const data = await payloadFetch<PayloadList<Editorial>>("editorials", {
    "where[slug][equals]": slug,
    depth: "1",
  });
  return data.docs[0] ?? null;
}

export async function getChangelog(): Promise<ChangelogEntry[]> {
  const data = await payloadFetch<PayloadList<ChangelogEntry>>("changelog", {
    limit: "100",
    sort: "-date",
    depth: "1",
  });
  return data.docs;
}

// ============ GLOBALS ============

export interface HomePageData {
  headline: string;
  headlineEmphasis?: string;
  subtext: string;
  bundleTitle: string;
  bundleDescription: string;
  bundlePrice: number;
  bundleGumroadUrl: string;
  authorBlurb: string;
}

export interface AboutPageData {
  title: string;
  metaDescription: string;
  bio: unknown; // Lexical JSON
}

export interface SiteSettingsData {
  defaultMetaDescription: string;
  restaurantCalloutTitle: string;
  restaurantCalloutText: string;
  restaurantCalloutEmail: string;
  changelogSubtitle: string;
}

async function getGlobal<T>(slug: string): Promise<T> {
  const url = new URL(`${PAYLOAD_URL}/api/globals/${slug}`);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Global ${slug} fetch error: ${res.status}`);
  return res.json() as Promise<T>;
}

export const getHomePage = () => getGlobal<HomePageData>("homePage");
export const getAboutPage = () => getGlobal<AboutPageData>("aboutPage");
export const getSiteSettings = () => getGlobal<SiteSettingsData>("siteSettings");
