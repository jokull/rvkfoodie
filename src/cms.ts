/**
 * agent-cms in-process client for the public consumer site. The SAME worker
 * that serves /app (internal SPA) and /g (hotel guides) also renders the
 * public site: agent-cms runs in-process against the shared D1, so the
 * consumer content (content_guide + block_* DAST trees) is read exactly as
 * the legacy site read it — no reimplementation of the content model.
 * Queries are plain GraphQL strings with hand-typed shapes (the legacy used
 * gql.tada; the codegen step adds nothing here).
 */
import { createCMSHandler } from 'agent-cms'
import { env } from 'cloudflare:workers'

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
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> => {
  const result = await getCmsHandler().execute(query, variables)
  if (result.errors?.length) {
    throw new Error(`CMS GraphQL: ${result.errors.map((e) => e.message).join(', ')}`)
  }
  return result.data as T
}

// The blocks are inline in the GraphQL response; a fragment is just a
// repeated inline selection here.
const GUIDE_BLOCKS = `
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
`

const VENUE_FRAGMENT = `
  fragment VenueFields on VenueRecord @_unmask {
    id name address description note time isFree
    location { latitude longitude }
    openingHours googleMapsUrl website phone
    bestOfAward grapevineUrl
    image { id url alt width height }
  }
`

const GUIDE_FIELDS = `
  id title slug subtitle description price
  gumroadProductId gumroadUrl googleMapsUrl
  intro { value }
`

const ALL_GUIDES = `
  allGuides(orderBy: [price_DESC]) {
    ${GUIDE_FIELDS}
    ${GUIDE_BLOCKS}
  }
`

const ALL_EDITORIALS = `
  allEditorials(orderBy: [date_DESC]) {
    id title slug excerpt date
    image { id url alt width height }
    content { value blocks { __typename ...ImageBlockFields } }
  }
`

export const HOME_PAGE_QUERY = `
  query HomePageData {
    homePage {
      id headline headlineEmphasis subtext
      bundleTitle bundleDescription bundlePrice bundleGumroadUrl
      authorBlurb
    }
    ${ALL_GUIDES}
    ${ALL_EDITORIALS}
  }
`

export const GUIDE_PAGE_QUERY = `
  query GuidePageData($slug: String!) {
    guide(filter: { slug: { eq: $slug } }) {
      ${GUIDE_FIELDS}
      ${GUIDE_BLOCKS}
    }
    ${ALL_GUIDES}
    ${ALL_EDITORIALS}
  }
`

export const BLOG_PAGE_QUERY = `
  query BlogPageData($slug: String!) {
    editorial(filter: { slug: { eq: $slug } }) {
      id title slug excerpt date
      image { id url alt width height }
      content { value blocks { __typename ...ImageBlockFields } }
    }
    ${ALL_GUIDES}
    ${ALL_EDITORIALS}
  }
`

export const CHANGELOG_PAGE_QUERY = `
  query ChangelogPageData {
    allChangelogEntries(orderBy: [date_DESC]) {
      id date title description changeType
      guide { id title slug }
    }
    siteSettings {
      id changelogSubtitle
    }
  }
`

export const ABOUT_PAGE_QUERY = `
  query AboutPageData {
    aboutPage { id title metaDescription bio { value } }
    ${ALL_GUIDES}
  }
`

const QUERY_PREFIX = `${VENUE_FRAGMENT}

fragment ImageBlockFields on ImageBlockRecord @_unmask {
  id
  image { id url alt width height }
  caption
}
`

const withFragments = (q: string) => `${QUERY_PREFIX}\n${q}`

// ============ TYPES (mirror the legacy map functions) ============

/** DAST trees are opaque JSON — this keeps the server-fn payloads serializable. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

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
export type TextBlock = {
  blockType: 'textBlock'
  id: string
  heading: string | null
  content: Json
  isFree: boolean
}
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

export interface Editorial {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  date?: string | null
  image?: CmsImage | null
  content?: Json
}

export interface ChangelogEntry {
  id: string
  date?: string | null
  title: string
  description?: string | null
  changeType?: string | null
  guide?: { id: string; title?: string | null; slug?: string | null } | null
}

export interface HomePageData {
  id: string
  headline?: string | null
  headlineEmphasis?: string | null
  subtext?: string | null
  bundleTitle?: string | null
  bundleDescription?: string | null
  bundlePrice?: number | null
  bundleGumroadUrl?: string | null
  authorBlurb?: string | null
}

// ============ MAPPERS ============

const mapVenue = (v: Record<string, unknown>): Venue => ({
  blockType: 'venue',
  id: String(v.id),
  name: (v.name as string) ?? '',
  address: (v.address as string) ?? '',
  description: (v.description as string) ?? '',
  note: (v.note as string) ?? undefined,
  time: (v.time as string) ?? undefined,
  isFree: Boolean(v.isFree),
  latitude: (v.location as { latitude?: number } | null)?.latitude ?? undefined,
  longitude: (v.location as { longitude?: number } | null)?.longitude ?? undefined,
  openingHours: (v.openingHours as string) ?? undefined,
  googleMapsUrl: (v.googleMapsUrl as string) ?? undefined,
  website: (v.website as string) ?? undefined,
  phone: (v.phone as string) ?? undefined,
  bestOfAward: (v.bestOfAward as string) ?? undefined,
  grapevineUrl: (v.grapevineUrl as string) ?? undefined,
  image: v.image ? ({ ...(v.image as CmsImage), alt: (v.image as CmsImage).alt ?? undefined } as CmsImage) : undefined,
})

const mapGuide = (raw: Record<string, unknown>): Guide => ({
  id: String(raw.id),
  title: (raw.title as string) ?? '',
  slug: (raw.slug as string) ?? '',
  subtitle: (raw.subtitle as string) ?? '',
  description: (raw.description as string) ?? '',
  price: (raw.price as number) ?? 0,
  gumroadProductId: (raw.gumroadProductId as string) ?? '',
  gumroadUrl: (raw.gumroadUrl as string) ?? '',
  googleMapsUrl: (raw.googleMapsUrl as string) ?? null,
  intro: raw.intro as Json | undefined,
  content: mapContentBlocks(raw.content as { blocks?: unknown[] } | null | undefined),
})

function mapContentBlocks(content: { blocks?: unknown[] } | null | undefined): ContentBlock[] {
  if (!content?.blocks) return []
  return content.blocks
    .map((b): ContentBlock | null => {
      const block = b as Record<string, unknown>
      if (block.__typename === 'SectionRecord') {
        return {
          blockType: 'section',
          id: String(block.id),
          title: (block.title as string) ?? '',
          venues: ((block.venues as { blocks?: unknown[] })?.blocks ?? [])
            .filter((v) => (v as Record<string, unknown>).__typename === 'VenueRecord')
            .map((v) => mapVenue(v as Record<string, unknown>)),
        }
      }
      if (block.__typename === 'TextBlockRecord') {
        return {
          blockType: 'textBlock',
          id: String(block.id),
          heading: (block.heading as string | null) ?? null,
          content: block.content as Json,
          isFree: Boolean(block.isFree),
        }
      }
      return null
    })
    .filter((b): b is ContentBlock => b !== null)
}

// ============ PAGE FETCHERS ============

export const getHomePageData = () =>
  execute<{
    homePage: HomePageData | null
    allGuides: Record<string, unknown>[]
    allEditorials: Editorial[]
  }>(withFragments(HOME_PAGE_QUERY)).then((d) => ({
    home: d.homePage!,
    guides: d.allGuides.map(mapGuide),
    editorials: d.allEditorials,
  }))

export const getGuidePageData = (slug: string) =>
  execute<{
    guide: Record<string, unknown> | null
    allGuides: Record<string, unknown>[]
    allEditorials: Editorial[]
  }>(withFragments(GUIDE_PAGE_QUERY), { slug }).then((d) => ({
    guide: d.guide ? mapGuide(d.guide) : null,
    allGuides: d.allGuides.map(mapGuide),
    editorials: d.allEditorials,
  }))

export const getBlogPageData = (slug: string) =>
  execute<{
    editorial: Editorial | null
    allGuides: Record<string, unknown>[]
    allEditorials: Editorial[]
  }>(withFragments(BLOG_PAGE_QUERY), { slug }).then((d) => ({
    post: d.editorial,
    allGuides: d.allGuides.map(mapGuide),
    allEditorials: d.allEditorials,
  }))

export const getChangelogPageData = () =>
  execute<{ allChangelogEntries: ChangelogEntry[]; siteSettings: { changelogSubtitle?: string | null } | null }>(
    withFragments(CHANGELOG_PAGE_QUERY),
  ).then((d) => ({
    entries: d.allChangelogEntries,
    changelogSubtitle: d.siteSettings?.changelogSubtitle ?? '',
  }))

export const getAboutPageData = () =>
  execute<{ aboutPage: { id: string; title?: string | null; metaDescription?: string | null; bio?: Json } | null; allGuides: Record<string, unknown>[] }>(
    withFragments(ABOUT_PAGE_QUERY),
  ).then((d) => ({
    about: d.aboutPage!,
    guides: d.allGuides.map(mapGuide),
  }))

export const getAllEditorials = () =>
  execute<{ allEditorials: Editorial[] }>(withFragments(`query AllEditorials { ${ALL_EDITORIALS} }`)).then(
    (d) => d.allEditorials,
  )
