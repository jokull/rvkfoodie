/**
 * agent-cms in-process client for the public consumer site, typed by
 * gql.tada against the live introspected schema (lib/graphql-schema.graphql).
 * The SAME worker that serves /app (internal SPA) and /g (hotel guides)
 * renders the public site: agent-cms runs in-process against the shared D1.
 * Queries are validated against the schema at typecheck — drift from the CMS
 * model surfaces as a tsc error, not a runtime 500.
 */
import { createCMSHandler } from 'agent-cms'
import { env } from 'cloudflare:workers'
import { print } from 'graphql'
import type { Json } from './cms-types.js'
import type { FragmentOf, ResultOf } from './graphql.js'
import { graphql } from './graphql.js'

let cached: ReturnType<typeof createCMSHandler> | null = null

export function getCmsHandler() {
  const r2 = env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
  cached ??= createCMSHandler({
    bindings: {
      db: env.DB,
      assets: env.MEDIA,
      environment: env.ENVIRONMENT,
      assetBaseUrl: env.ASSET_BASE_URL,
      writeKey: env.CMS_WRITE_KEY,
      ai: env.AI,
      vectorize: env.VECTORIZE,
      siteUrl: 'https://www.rvkfoodie.is',
      ...(r2
        ? {
            r2AccessKeyId: env.R2_ACCESS_KEY_ID,
            r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY,
            r2BucketName: 'rvkfoodie-cms',
            cfAccountId: '561f024b3ba2bbafa2a67ec9b911693c',
          }
        : {}),
    },
  })
  return cached
}

const execute = async <T>(
  document: Parameters<typeof print>[0],
  variables?: Record<string, unknown>,
): Promise<T> => {
  const result = await getCmsHandler().execute(print(document), variables)
  if (result.errors?.length) {
    throw new Error(`CMS GraphQL: ${result.errors.map((e) => e.message).join(', ')}`)
  }
  return result.data as T
}

// ============ FRAGMENTS ============

const VenueFragment = graphql(`
  fragment VenueFields on VenueRecord @_unmask {
    id name address description note time isFree
    location { latitude longitude }
    openingHours googleMapsUrl website phone
    bestOfAward grapevineUrl
    image { id url alt width height }
  }
`)

const ImageBlockFragment = graphql(`
  fragment ImageBlockFields on ImageBlockRecord @_unmask {
    id image { id url alt width height } caption
  }
`)

const GuideContentFragment = graphql(
  `
  fragment GuideContent on GuideRecord @_unmask {
    intro { value }
    content {
      value
      blocks {
        __typename
        ... on SectionRecord {
          id title
          venues { value blocks { __typename ...VenueFields } }
        }
        ... on TextBlockRecord { id heading isFree content { value } }
      }
    }
  }
`,
  [VenueFragment],
)

const GuideFieldsFragment = graphql(`
  fragment GuideFields on GuideRecord @_unmask {
    id title slug subtitle description price
    gumroadProductId gumroadUrl googleMapsUrl
  }
`)

const EditorialFieldsFragment = graphql(
  `
  fragment EditorialFields on EditorialRecord @_unmask {
    id title slug excerpt date
    image { id url alt width height }
    content { value blocks { __typename ...ImageBlockFields } }
  }
`,
  [ImageBlockFragment],
)

// ============ QUERIES ============

const HomePageDataQuery = graphql(
  `
  query HomePageData {
    homePage {
      id headline headlineEmphasis subtext
      bundleTitle bundleDescription bundlePrice bundleGumroadUrl
      authorBlurb
    }
    allGuides(orderBy: [price_DESC]) {
      ...GuideFields
      ...GuideContent
    }
    allEditorials(orderBy: [date_DESC]) {
      ...EditorialFields
    }
  }
`,
  [GuideFieldsFragment, GuideContentFragment, EditorialFieldsFragment],
)

const GuidePageDataQuery = graphql(
  `
  query GuidePageData($slug: String!) {
    guide(filter: { slug: { eq: $slug } }) {
      ...GuideFields
      ...GuideContent
    }
    allGuides(orderBy: [price_DESC]) {
      ...GuideFields
      ...GuideContent
    }
    allEditorials(orderBy: [date_DESC]) {
      ...EditorialFields
    }
  }
`,
  [GuideFieldsFragment, GuideContentFragment, EditorialFieldsFragment],
)

const BlogPageDataQuery = graphql(
  `
  query BlogPageData($slug: String!) {
    editorial(filter: { slug: { eq: $slug } }) {
      ...EditorialFields
    }
    allGuides(orderBy: [price_DESC]) {
      ...GuideFields
      ...GuideContent
    }
    allEditorials(orderBy: [date_DESC]) {
      ...EditorialFields
    }
  }
`,
  [GuideFieldsFragment, GuideContentFragment, EditorialFieldsFragment],
)

const ChangelogPageDataQuery = graphql(`
  query ChangelogPageData {
    allChangelogEntries(orderBy: [date_DESC]) {
      id date title description changeType
      guide { id title slug }
    }
    siteSettings { id changelogSubtitle }
  }
`)

const AboutPageDataQuery = graphql(
  `
  query AboutPageData {
    aboutPage { id title metaDescription bio { value } }
    allGuides(orderBy: [price_DESC]) {
      ...GuideFields
      ...GuideContent
    }
  }
`,
  [GuideFieldsFragment, GuideContentFragment],
)

const AllEditorialsQuery = graphql(
  `
  query AllEditorials {
    allEditorials(orderBy: [date_DESC]) {
      ...EditorialFields
    }
  }
`,
  [EditorialFieldsFragment],
)

const GuidesAndEditorialsQuery = graphql(
  `
  query GuidesAndEditorials {
    allGuides(orderBy: [price_DESC]) {
      ...GuideFields
      ...GuideContent
    }
    allEditorials(orderBy: [date_DESC]) {
      ...EditorialFields
    }
  }
`,
  [GuideFieldsFragment, GuideContentFragment, EditorialFieldsFragment],
)

// ============ TYPES ============

type RawGuide = NonNullable<ResultOf<typeof GuidePageDataQuery>['allGuides']>[number]
type RawEditorial = NonNullable<ResultOf<typeof AllEditorialsQuery>['allEditorials']>[number]
export type RawVenue = FragmentOf<typeof VenueFragment>
export type Editorial = RawEditorial
export type ChangelogEntry = NonNullable<ResultOf<typeof ChangelogPageDataQuery>['allChangelogEntries']>[number]
export type HomePageData = NonNullable<ResultOf<typeof HomePageDataQuery>['homePage']>
export type AboutPageData = NonNullable<ResultOf<typeof AboutPageDataQuery>['aboutPage']>
export type SiteSettingsData = NonNullable<ResultOf<typeof ChangelogPageDataQuery>['siteSettings']>

export interface CmsImage {
  id: string
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
}

export interface Venue {
  blockType: 'venue'
  id: string
  name: string
  address: string
  description: string
  note?: string
  time?: string
  isFree: boolean
  latitude?: number
  longitude?: number
  openingHours?: string
  googleMapsUrl?: string
  website?: string
  phone?: string
  bestOfAward?: string
  grapevineUrl?: string
  image?: CmsImage
}

export type SectionBlock = { blockType: 'section'; id: string; title: string; venues: Venue[] }
export type TextBlock = { blockType: 'textBlock'; id: string; heading: string | null; content: Json; isFree: boolean }
export type ContentBlock = SectionBlock | TextBlock

export interface Guide {
  id: string
  title: string
  slug: string
  subtitle: string
  description: string
  price: number
  gumroadProductId: string
  gumroadUrl: string
  googleMapsUrl?: string | null
  intro?: Json
  content: ContentBlock[]
}

// ============ MAPPERS ============

const mapVenue = (v: RawVenue): Venue => {
  return {
    blockType: 'venue',
    id: v.id,
    name: v.name ?? '',
    address: v.address ?? '',
    description: v.description ?? '',
    note: v.note ?? undefined,
    time: v.time ?? undefined,
    isFree: v.isFree ?? false,
    latitude: v.location?.latitude ?? undefined,
    longitude: v.location?.longitude ?? undefined,
    openingHours: v.openingHours ?? undefined,
    googleMapsUrl: v.googleMapsUrl ?? undefined,
    website: v.website ?? undefined,
    phone: v.phone ?? undefined,
    bestOfAward: v.bestOfAward ?? undefined,
    grapevineUrl: v.grapevineUrl ?? undefined,
    image: v.image ? { ...v.image, alt: v.image.alt ?? undefined } : undefined,
  }
}

const mapGuide = (raw: RawGuide): Guide => {
  return {
    id: raw.id,
    title: raw.title ?? '',
    slug: raw.slug ?? '',
    subtitle: raw.subtitle ?? '',
    description: raw.description ?? '',
    price: raw.price ?? 0,
    gumroadProductId: raw.gumroadProductId ?? '',
    gumroadUrl: raw.gumroadUrl ?? '',
    googleMapsUrl: raw.googleMapsUrl ?? null,
    intro: raw.intro?.value,
    content: mapContentBlocks(raw.content),
  }
}

function mapContentBlocks(content: RawGuide['content']): ContentBlock[] {
  if (!content?.blocks) return []
  return content.blocks
    .map((b): ContentBlock | null => {
      if (b.__typename === 'SectionRecord') {
        return {
          blockType: 'section',
          id: b.id,
          title: b.title ?? '',
          venues: (b.venues?.blocks ?? [])
            .filter((v) => v.__typename === 'VenueRecord')
            .map((v) => mapVenue(v as RawVenue)),
        }
      }
      if (b.__typename === 'TextBlockRecord') {
        return {
          blockType: 'textBlock',
          id: b.id,
          heading: b.heading ?? null,
          content: b.content?.value ?? null,
          isFree: b.isFree ?? false,
        }
      }
      return null
    })
    .filter((b): b is ContentBlock => b !== null)
}

// ============ PAGE FETCHERS ============

export const getHomePageData = async () => {
  const data = await execute<ResultOf<typeof HomePageDataQuery>>(HomePageDataQuery)
  return {
    home: data.homePage!,
    guides: data.allGuides.map(mapGuide),
    editorials: data.allEditorials,
  }
}

export const getGuidePageData = async (slug: string) => {
  const data = await execute<ResultOf<typeof GuidePageDataQuery>>(GuidePageDataQuery, { slug })
  return {
    guide: data.guide ? mapGuide(data.guide) : null,
    allGuides: data.allGuides.map(mapGuide),
    editorials: data.allEditorials,
  }
}

export const getBlogPageData = async (slug: string) => {
  const data = await execute<ResultOf<typeof BlogPageDataQuery>>(BlogPageDataQuery, { slug })
  return {
    post: data.editorial ?? null,
    allGuides: data.allGuides.map(mapGuide),
    allEditorials: data.allEditorials,
  }
}

export const getChangelogPageData = async () => {
  const data = await execute<ResultOf<typeof ChangelogPageDataQuery>>(ChangelogPageDataQuery)
  return {
    entries: data.allChangelogEntries,
    changelogSubtitle: data.siteSettings?.changelogSubtitle ?? '',
  }
}

export const getAboutPageData = async () => {
  const data = await execute<ResultOf<typeof AboutPageDataQuery>>(AboutPageDataQuery)
  return {
    about: data.aboutPage!,
    guides: data.allGuides.map(mapGuide),
  }
}

export const getAllEditorials = async () => {
  const data = await execute<ResultOf<typeof AllEditorialsQuery>>(AllEditorialsQuery)
  return data.allEditorials
}

export const getGuidesAndEditorials = async () => {
  const data = await execute<ResultOf<typeof GuidesAndEditorialsQuery>>(GuidesAndEditorialsQuery)
  return {
    guides: data.allGuides.map(mapGuide),
    editorials: data.allEditorials,
  }
}
