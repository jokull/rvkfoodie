/**
 * agent-cms GraphQL client for rvkfoodie.is
 * Uses gql.tada for statically typed queries.
 */

import { graphql, readFragment, type FragmentOf, type ResultOf } from "gql.tada";

const GRAPHQL_URL = "https://rvkfoodie-agent-cms.solberg.workers.dev/graphql";

async function execute<T>(query: { toString(): string }, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: query.toString(), variables }),
  });
  if (!res.ok) throw new Error(`GraphQL error: ${res.status}`);
  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
  return json.data;
}

// ============ QUERIES ============

const AllGuidesQuery = graphql(`
  query AllGuides {
    allGuides(orderBy: [price_DESC]) {
      id title slug subtitle description price
      gumroadProductId gumroadUrl googleMapsUrl
      intro { value }
      content {
        value
        blocks {
          __typename
          ... on SectionRecord {
            id title
            venues {
              value
              blocks {
                __typename
                ... on VenueRecord {
                  id name address description note time isFree
                  location { latitude longitude }
                  openingHours googleMapsUrl website phone
                  bestOfAward grapevineUrl
                  image { id url alt width height }
                }
              }
            }
          }
          ... on TextBlockRecord {
            id heading isFree
            content { value }
          }
        }
      }
    }
  }
`);

const GuideBySlugQuery = graphql(`
  query GuideBySlug($slug: String!) {
    guide(filter: { slug: { eq: $slug } }) {
      id title slug subtitle description price
      gumroadProductId gumroadUrl googleMapsUrl
      intro { value }
      content {
        value
        blocks {
          __typename
          ... on SectionRecord {
            id title
            venues {
              value
              blocks {
                __typename
                ... on VenueRecord {
                  id name address description note time isFree
                  location { latitude longitude }
                  openingHours googleMapsUrl website phone
                  bestOfAward grapevineUrl
                  image { id url alt width height }
                }
              }
            }
          }
          ... on TextBlockRecord {
            id heading isFree
            content { value }
          }
        }
      }
    }
  }
`);

const AllEditorialsQuery = graphql(`
  query AllEditorials {
    allEditorials(orderBy: [date_DESC]) {
      id title slug excerpt date
      image { id url alt width height }
      content { value }
    }
  }
`);

const EditorialBySlugQuery = graphql(`
  query EditorialBySlug($slug: String!) {
    editorial(filter: { slug: { eq: $slug } }) {
      id title slug excerpt date
      image { id url alt width height }
      content { value }
    }
  }
`);

const ChangelogQuery = graphql(`
  query Changelog {
    allChangelogEntrys(orderBy: [date_DESC]) {
      id date title description changeType
      guide { id title slug }
    }
  }
`);

const HomePageQuery = graphql(`
  query HomePage {
    homePage {
      headline headlineEmphasis subtext
      bundleTitle bundleDescription bundlePrice bundleGumroadUrl
      authorBlurb
    }
  }
`);

const AboutPageQuery = graphql(`
  query AboutPage {
    aboutPage { title metaDescription bio { value } }
  }
`);

const SiteSettingsQuery = graphql(`
  query SiteSettings {
    siteSettings {
      defaultMetaDescription restaurantCalloutTitle
      restaurantCalloutText restaurantCalloutEmail
      changelogSubtitle
    }
  }
`);

// ============ TYPES (derived from queries) ============

export type Guide = ReturnType<typeof mapGuide>;
export type Editorial = NonNullable<ResultOf<typeof AllEditorialsQuery>["allEditorials"]>[number];
export type ChangelogEntry = NonNullable<ResultOf<typeof ChangelogQuery>["allChangelogEntrys"]>[number];
export type HomePageData = NonNullable<ResultOf<typeof HomePageQuery>["homePage"]>;
export type AboutPageData = NonNullable<ResultOf<typeof AboutPageQuery>["aboutPage"]>;
export type SiteSettingsData = NonNullable<ResultOf<typeof SiteSettingsQuery>["siteSettings"]>;

// Re-export block types for template use
export interface PayloadImage {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

export interface Venue {
  id: string;
  blockType: "venue";
  name: string;
  address: string;
  description: string;
  note?: string | null;
  time?: string | null;
  isFree: boolean;
  latitude?: number;
  longitude?: number;
  openingHours?: string | null;
  googleMapsUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  bestOfAward?: string | null;
  grapevineUrl?: string | null;
  image?: PayloadImage | null;
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
  heading?: string | null;
  content: unknown;
  isFree: boolean;
}

export type ContentBlock = SectionBlock | TextBlock;

// ============ FETCHERS ============

export async function getAllGuides() {
  const data = await execute<ResultOf<typeof AllGuidesQuery>>(AllGuidesQuery);
  return data.allGuides.map(mapGuide);
}

export async function getGuideBySlug(slug: string) {
  const data = await execute<ResultOf<typeof GuideBySlugQuery>>(GuideBySlugQuery, { slug });
  return data.guide ? mapGuide(data.guide) : null;
}

export async function getAllEditorials() {
  const data = await execute<ResultOf<typeof AllEditorialsQuery>>(AllEditorialsQuery);
  return data.allEditorials;
}

export async function getEditorialBySlug(slug: string) {
  const data = await execute<ResultOf<typeof EditorialBySlugQuery>>(EditorialBySlugQuery, { slug });
  return data.editorial;
}

export async function getChangelog() {
  const data = await execute<ResultOf<typeof ChangelogQuery>>(ChangelogQuery);
  return data.allChangelogEntrys;
}

export async function getHomePage() {
  const data = await execute<ResultOf<typeof HomePageQuery>>(HomePageQuery);
  return data.homePage!;
}

export async function getAboutPage() {
  const data = await execute<ResultOf<typeof AboutPageQuery>>(AboutPageQuery);
  return data.aboutPage!;
}

export async function getSiteSettings() {
  const data = await execute<ResultOf<typeof SiteSettingsQuery>>(SiteSettingsQuery);
  return data.siteSettings!;
}

// ============ MAPPERS ============

type RawGuide = NonNullable<ResultOf<typeof AllGuidesQuery>["allGuides"]>[number];
type RawBlock = NonNullable<RawGuide["content"]>["blocks"][number];
type RawSectionRecord = Extract<RawBlock, { __typename: "SectionRecord" }>;
type RawVenueRecord = NonNullable<RawSectionRecord["venues"]>["blocks"][number];

function mapGuide(raw: RawGuide) {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    subtitle: raw.subtitle,
    description: raw.description,
    price: raw.price,
    gumroadProductId: raw.gumroadProductId,
    gumroadUrl: raw.gumroadUrl,
    googleMapsUrl: raw.googleMapsUrl,
    intro: raw.intro,
    content: mapBlocks(raw.content),
  };
}

function mapVenue(v: Extract<RawVenueRecord, { __typename: "VenueRecord" }>): Venue {
  return {
    ...v,
    blockType: "venue" as const,
    isFree: v.isFree ?? false,
    latitude: v.location?.latitude ?? undefined,
    longitude: v.location?.longitude ?? undefined,
  };
}

function mapBlocks(content: RawGuide["content"]): ContentBlock[] {
  if (!content?.blocks) return [];
  return content.blocks
    .map((b): ContentBlock | null => {
      if (b.__typename === "SectionRecord") {
        return {
          id: b.id,
          blockType: "section" as const,
          title: b.title,
          venues: (b.venues?.blocks || [])
            .filter((v): v is Extract<typeof v, { __typename: "VenueRecord" }> => v.__typename === "VenueRecord")
            .map(mapVenue),
        };
      }
      if (b.__typename === "TextBlockRecord") {
        return {
          id: b.id,
          blockType: "textBlock" as const,
          heading: b.heading,
          content: b.content,
          isFree: b.isFree ?? false,
        };
      }
      return null;
    })
    .filter((b): b is ContentBlock => b !== null);
}
