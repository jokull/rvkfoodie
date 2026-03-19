import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageBlock } from "@/app/_components/image-block";
import {
  getEditorialBySlug,
  getAllEditorials,
  getAllGuides,
  type SectionBlock,
} from "@/lib/cms";
import { dastToHtml } from "@/lib/dast";
import { mediaUrl } from "@/lib/images";
import { EditWrapper, EditBar, CmsField, CmsText, CmsImage } from "@/app/_components/visual-edit";

type ContentNode = { type: string; item?: string; [k: string]: unknown };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getEditorialBySlug(slug);
  if (!post) return {};
  const heroUrl = post.image
    ? mediaUrl(post.image.filename || post.image.url)
    : null;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      publishedTime: post.date,
      ...(heroUrl ? { images: [{ url: heroUrl }] } : {}),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, allGuides, allEditorials] = await Promise.all([
    getEditorialBySlug(slug),
    getAllGuides(),
    getAllEditorials(),
  ]);
  if (!post) notFound();

  // Find venues mentioned in this post (match by name in title/excerpt/content)
  const postText = `${post.title} ${post.excerpt}`.toLowerCase();
  const mentionedVenues: {
    name: string;
    address: string;
    id: string;
    guideSlug: string;
    guideTitle: string;
  }[] = [];
  for (const guide of allGuides) {
    for (const block of guide.content) {
      if (block.blockType !== "section") continue;
      for (const v of (block as SectionBlock).venues) {
        const vName = v.name.toLowerCase().replace(/[!?]/g, "");
        if (
          postText.includes(vName) ||
          vName.split(" ").every((w) => w.length > 3 && postText.includes(w))
        ) {
          mentionedVenues.push({
            name: v.name,
            address: v.address,
            id: v.id,
            guideSlug: guide.slug,
            guideTitle: guide.title,
          });
        }
      }
    }
  }

  // Other blog posts (exclude current)
  const otherPosts = allEditorials
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  const dateStr = new Date(post.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const heroUrl = post.image
    ? mediaUrl(post.image.filename || post.image.url)
    : null;

  // Parse content DAST nodes and image blocks
  const contentValue = post.content?.value as
    | { document?: { children?: ContentNode[] } }
    | undefined;
  const contentBlocks = post.content?.blocks ?? [];
  const contentBlocksById = new Map(
    contentBlocks.map((b) => [b.id, b]),
  );
  const contentNodes = contentValue?.document?.children ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    mainEntityOfPage: `https://www.rvkfoodie.is/blog/${post.slug}`,
    author: {
      "@type": "Person",
      name: "Reykjavik Foodie",
      url: "https://www.rvkfoodie.is/about",
    },
    publisher: {
      "@type": "Organization",
      name: "Reykjavik Foodie",
      url: "https://www.rvkfoodie.is",
      logo: {
        "@type": "ImageObject",
        url: "https://www.rvkfoodie.is/logo.svg",
      },
    },
    ...(heroUrl ? { image: heroUrl } : {}),
  };

  const content = (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <a
        href="/"
        className="text-tiny text-ink-light hover:text-blue transition-colors mb-8 inline-block"
      >
        ← Home
      </a>

      <article>
        <p className="text-tiny leading-tiny text-ink-light mb-4">{dateStr}</p>
        <CmsField fieldApiKey="title" value={post.title}>
          <h1 className="font-display text-huge leading-huge mb-10">
            {post.title}
          </h1>
        </CmsField>

        {heroUrl && post.image && (
          <CmsImage assetId={post.image.id} fieldApiKey="image">
            <div className="mb-12 rounded-2xl overflow-hidden">
              <img
                src={heroUrl}
                alt={post.image.alt || post.title}
                className="w-full rounded-2xl"
                loading="eager"
              />
            </div>
          </CmsImage>
        )}

        <CmsText fieldApiKey="content" value={post.content?.value as import("@agent-cms/visual-edit").DastDocument}>
          <div className="prose-custom">
            {contentNodes.map((node, i) => {
              if (node.type === "block" && node.item) {
                const block = contentBlocksById.get(node.item);
                if (block?.image)
                  return <ImageBlock key={node.item} block={block} />;
                return null;
              }
              const html = dastToHtml({
                value: {
                  schema: "dast",
                  document: { type: "root", children: [node] },
                },
              });
              return html ? (
                <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
              ) : null;
            })}
          </div>
        </CmsText>
      </article>

      {mentionedVenues.length > 0 && (
        <aside className="mt-16 border-t border-ink/10 pt-8">
          <h2 className="font-display text-[1.5rem] leading-tight mb-4">
            Mentioned in this post
          </h2>
          <div className="space-y-4">
            {mentionedVenues.map((v) => (
              <a
                key={v.id}
                href={`/places/${v.id}`}
                className="flex items-center justify-between border border-ink/10 rounded-xl p-5 hover:border-ink/25 transition-colors group"
              >
                <div>
                  <h3 className="font-display text-[1.25rem] leading-tight group-hover:text-blue transition-colors">
                    {v.name}
                  </h3>
                  {v.address && (
                    <p className="text-tiny text-ink-light mt-1">{v.address}</p>
                  )}
                </div>
                <span className="text-tiny text-ink-light whitespace-nowrap ml-4">
                  {v.guideTitle}
                </span>
              </a>
            ))}
          </div>
        </aside>
      )}

      {otherPosts.length > 0 && (
        <aside className="mt-12 border-t border-ink/10 pt-8">
          <h2 className="font-display text-[1.5rem] leading-tight mb-4">
            More from the blog
          </h2>
          <div className="space-y-4">
            {otherPosts.map((p) => (
              <a
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="block border border-ink/10 rounded-xl p-5 hover:border-ink/25 transition-colors group"
              >
                <p className="text-tiny text-ink-light mb-1">
                  {new Date(p.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <h3 className="font-display text-[1.25rem] leading-tight group-hover:text-blue transition-colors">
                  {p.title}
                </h3>
              </a>
            ))}
          </div>
        </aside>
      )}

      <aside className="mt-12 border-t border-ink/10 pt-8">
        <p className="text-tiny text-ink-light mb-4">Explore our guides</p>
        <div className="flex flex-wrap gap-3">
          {allGuides.map((guide) => (
            <a
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="border border-ink/10 rounded-full px-4 py-1.5 text-tiny hover:border-blue hover:text-blue transition-colors"
            >
              {guide.title} — ${guide.price}
            </a>
          ))}
        </div>
      </aside>
    </>
  );

  return (
    <EditWrapper recordId={post.id} modelApiKey="editorial">
      {content}
      <EditBar />
    </EditWrapper>
  );
}
