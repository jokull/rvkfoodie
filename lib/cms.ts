/**
 * agent-cms GraphQL client for rvkfoodie.is
 * Uses gql.tada for statically typed queries with in-process execute().
 */

import { graphql, type ResultOf } from "gql.tada";
import { print } from "graphql";
import { getCmsHandler } from "./cms-handler";

async function execute<T>(document: { kind: "Document" }, variables?: Record<string, unknown>): Promise<T> {
  const t0 = performance.now();
  const queryString = print(document as Parameters<typeof print>[0]);
  const tPrint = performance.now();

  const opMatch = queryString.match(/(?:query|mutation)\s+(\w+)/);
  const opName = opMatch?.[1] ?? "anonymous";

  const result = await getCmsHandler().execute(queryString, variables);
  const tExec = performance.now();

  if (result.errors?.length) {
    throw new Error(`GraphQL: ${result.errors.map((e) => e.message).join(", ")}`);
  }

  console.log(`[cms] ${opName}: print=${(tPrint - t0).toFixed(0)}ms execute=${(tExec - tPrint).toFixed(0)}ms total=${(tExec - t0).toFixed(0)}ms`);

  return result.data as T;
}

// ============ QUERIES (inline, no fragments) ============

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
      image { id url alt width height filename }
      content {
        value
        blocks {
          __typename
          ... on ImageBlockRecord {
            id
            image { id url alt width height filename }
            caption
          }
        }
      }
    }
  }
`);

const EditorialBySlugQuery = graphql(`
  query EditorialBySlug($slug: String!) {
    editorial(filter: { slug: { eq: $slug } }) {
      id title slug excerpt date
      image { id url alt width height filename }
      content {
        value
        blocks {
          __typename
          ... on ImageBlockRecord {
            id
            image { id url alt width height filename }
            caption
          }
        }
      }
    }
  }
`);

const ChangelogQuery = graphql(`
  query Changelog {
    allChangelogEntries(orderBy: [date_DESC]) {
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
type RawVenue = Extract<NonNullable<RawSection["venues"]>["blocks"][number], { __typename: "VenueRecord" }>;

export type Editorial = NonNullable<ResultOf<typeof AllEditorialsQuery>["allEditorials"]>[number];
export type ChangelogEntry = NonNullable<ResultOf<typeof ChangelogQuery>["allChangelogEntries"]>[number];
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
  return data.allChangelogEntries;
}

export async function getHomePage() {
  const data = await execute<ResultOf<typeof HomePageQuery>>(HomePageQuery);
  if (!data.homePage) throw new Error("HomePage singleton not found in CMS");
  return data.homePage;
}

export async function getAboutPage() {
  const data = await execute<ResultOf<typeof AboutPageQuery>>(AboutPageQuery);
  if (!data.aboutPage) throw new Error("AboutPage singleton not found in CMS");
  return data.aboutPage;
}

export async function getSiteSettings() {
  const data = await execute<ResultOf<typeof SiteSettingsQuery>>(SiteSettingsQuery);
  if (!data.siteSettings) throw new Error("SiteSettings singleton not found in CMS");
  return data.siteSettings;
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

function mapVenue(v: RawVenue) {
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
            .filter((v): v is RawVenue => v.__typename === "VenueRecord")
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
