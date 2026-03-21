import type { Metadata } from "next";

type SeoTag = {
  tag: string;
  attributes?: Record<string, string> | null;
  content?: string | null;
};

/**
 * Convert DatoCMS-compatible _seoMetaTags to a vinext Metadata object.
 * Site-level fallbacks (title template, default OG image, metadataBase)
 * are handled by the root layout's static metadata export.
 */
export function seoTagsToMetadata(
  tags: ReadonlyArray<{ tag: string; attributes: unknown; content: string | null }>,
): Metadata {
  const metadata: Metadata = {};
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};

  for (const raw of tags) {
    const t = raw as SeoTag;
    if (t.tag === "title" && t.content) {
      metadata.title = t.content;
    }
    if (t.tag === "meta" && t.attributes) {
      const a = t.attributes;
      if (a.name === "description" && a.content) {
        metadata.description = a.content;
      }
      if (a.property?.startsWith("og:") && a.content) {
        og[a.property] = a.content;
      }
      if (a.name?.startsWith("twitter:") && a.content) {
        twitter[a.name] = a.content;
      }
    }
  }

  if (Object.keys(og).length > 0) {
    metadata.openGraph = {};
    if (og["og:title"]) metadata.openGraph.title = og["og:title"];
    if (og["og:description"])
      metadata.openGraph.description = og["og:description"];
    if (og["og:image"])
      metadata.openGraph.images = [{ url: og["og:image"] }];
  }

  if (twitter["twitter:card"]) {
    metadata.twitter = {
      card: twitter["twitter:card"] as "summary" | "summary_large_image",
    };
  }

  return metadata;
}
