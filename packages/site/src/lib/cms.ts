/**
 * agent-cms GraphQL client for rvkfoodie.is
 * Uses gql.tada for statically typed queries.
 */

import { graphql, type ResultOf } from "gql.tada";
import { print } from "graphql";

const GRAPHQL_URL = "https://rvkfoodie-agent-cms.solberg.workers.dev/graphql";

async function execute<T>(document: { kind: "Document" }, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: print(document as Parameters<typeof print>[0]), variables }),
  });
  if (!res.ok) throw new Error(`GraphQL error: ${res.status}`);
  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
  return json.data;
}

// ============ QUERIES (inline, no fragments) ============

const VENUE_FIELDS = `
  id name address description note time isFree
  location { latitude longitude }
  openingHours googleMapsUrl website phone
  bestOfAward grapevineUrl
  image { id url alt width height }
`;

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

// ============ TYPES (derived from gql.tada) ============

type RawGuide = NonNullable<ResultOf<typeof AllGuidesQuery>["allGuides"]>[number];
type RawBlock = NonNullable<RawGuide["content"]>["blocks"][number];
type RawSection = Extract<RawBlock, { __typename: "SectionRecord" }>;
type RawVenue = NonNullable<RawSection["venues"]>["blocks"][number];

export type Editorial = NonNullable<ResultOf<typeof AllEditorialsQuery>["allEditorials"]>[number];
export type ChangelogEntry = NonNullable<ResultOf<typeof ChangelogQuery>["allChangelogEntrys"]>[number];
export type HomePageData = NonNullable<ResultOf<typeof HomePageQuery>["homePage"]>;
export type AboutPageData = NonNullable<ResultOf<typeof AboutPageQuery>["aboutPage"]>;
export type SiteSettingsData = NonNullable<ResultOf<typeof SiteSettingsQuery>["siteSettings"]>;

// Mapped types with blockType discriminator for templates
export type Venue = ReturnType<typeof mapVenue>;
export type SectionBlock = { blockType: "section"; id: string; title: string; venues: Venue[] };
export type TextBlock = { blockType: "textBlock"; id: string; heading: string | null; content: unknown; isFree: boolean };
export type ContentBlock = SectionBlock | TextBlock;
export type Guide = ReturnType<typeof mapGuide>;

// Legacy compat
export type PayloadImage = NonNullable<Editorial["image"]>;

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
  return data.editorial ?? null;
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

function mapGuide(raw: RawGuide) {
  return {
    id: raw.id,
    title: raw.title ?? "",
    slug: raw.slug ?? "",
    subtitle: raw.subtitle ?? "",
    description: raw.description ?? "",
    price: raw.price ?? 0,
    gumroadProductId: raw.gumroadProductId ?? "",
    gumroadUrl: raw.gumroadUrl ?? "",
    googleMapsUrl: raw.googleMapsUrl,
    intro: raw.intro,
    content: mapContentBlocks(raw.content),
  };
}

function mapVenue(v: Extract<RawVenue, { __typename: "VenueRecord" }>) {
  return {
    blockType: "venue" as const,
    id: v.id,
    name: v.name ?? "",
    address: v.address ?? "",
    description: v.description ?? "",
    note: v.note,
    time: v.time,
    isFree: v.isFree ?? false,
    latitude: v.location?.latitude ?? undefined,
    longitude: v.location?.longitude ?? undefined,
    openingHours: v.openingHours,
    googleMapsUrl: v.googleMapsUrl,
    website: v.website,
    phone: v.phone,
    bestOfAward: v.bestOfAward,
    grapevineUrl: v.grapevineUrl,
    image: v.image,
  };
}

function mapContentBlocks(content: RawGuide["content"]): ContentBlock[] {
  if (!content?.blocks) return [];
  return content.blocks
    .map((b): ContentBlock | null => {
      if (b.__typename === "SectionRecord") {
        return {
          blockType: "section" as const,
          id: b.id,
          title: b.title ?? "",
          venues: (b.venues?.blocks ?? [])
            .filter((v): v is Extract<typeof v, { __typename: "VenueRecord" }> => v.__typename === "VenueRecord")
            .map(mapVenue),
        };
      }
      if (b.__typename === "TextBlockRecord") {
        return {
          blockType: "textBlock" as const,
          id: b.id,
          heading: b.heading ?? null,
          content: b.content,
          isFree: b.isFree ?? false,
        };
      }
      return null;
    })
    .filter((b): b is ContentBlock => b !== null);
}
