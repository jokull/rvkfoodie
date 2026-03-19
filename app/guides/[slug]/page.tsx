import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "cloudflare:workers";
import { VenueCard } from "@/app/_components/venue-card";
import { Paywall } from "@/app/_components/paywall";
import { RestaurantCallout } from "@/app/_components/restaurant-callout";
import {
  getGuideBySlug,
  getAllGuides,
  getAllEditorials,
  type SectionBlock,
  type TextBlock,
} from "@/lib/cms";
import { dastToHtml } from "@/lib/dast";
import { cookies } from "next/headers";
import { getSessionData, setSessionData, SESSION_COOKIE } from "@/lib/session";
import { EditWrapper, EditBar, CmsField, CmsText } from "@/app/_components/visual-edit";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      images: [{ url: `/og-${guide.slug}.jpg` }],
    },
  };
}

export default async function GuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; key?: string; pending?: string }>;
}) {
  const { slug } = await params;
  const { error, key: prefillKey = "", pending: pendingParam } =
    await searchParams;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value ?? null;

  // Parallelize all independent fetches
  const [guide, allGuides, editorials, sessionProducts, unlockToken] =
    await Promise.all([
      getGuideBySlug(slug),
      getAllGuides(),
      getAllEditorials(),
      sessionId
        ? getSessionData<string[]>(sessionId, "unlockedProducts").catch(() => null)
        : Promise.resolve(null),
      sessionId
        ? getSessionData<string>(sessionId, "unlockToken").catch(() => null)
        : Promise.resolve(null),
    ]);
  if (!guide) notFound();

  const otherGuides = allGuides.filter((g) => g.slug !== guide.slug);
  const unlockedProducts: string[] = sessionProducts ?? [];
  if (unlockToken && !unlockedProducts.includes(guide.gumroadProductId)) {
    const kv = env.PURCHASES;
    const raw = await kv.get(`unlock:${unlockToken}`);
    if (raw) {
      const purchase = JSON.parse(raw) as { productIds: string[] };
      for (const pid of purchase.productIds) {
        if (!unlockedProducts.includes(pid)) unlockedProducts.push(pid);
      }
      await setSessionData(sessionId, "unlockedProducts", unlockedProducts);
      await kv.delete(`unlock:${unlockToken}`);
      await setSessionData(sessionId, "unlockToken", null);
    }
  }

  const unlocked = unlockedProducts.includes(guide.gumroadProductId);
  const pending = pendingParam === "true";

  let totalHidden = 0;
  for (const block of guide.content) {
    if (block.blockType === "section") {
      totalHidden += (block as SectionBlock).venues.filter(
        (v) => !v.isFree,
      ).length;
    }
  }

  const totalVenues = guide.content.reduce(
    (n, b) =>
      b.blockType === "section"
        ? n + (b as SectionBlock).venues.length
        : n,
    0,
  );

  const introHtml = guide.intro ? dastToHtml(guide.intro) : "";

  // Find blog posts that mention venues from this guide
  const venueNames = guide.content.flatMap((b) =>
    b.blockType === "section"
      ? (b as SectionBlock).venues.map((v) =>
          v.name.toLowerCase().replace(/[!?]/g, ""),
        )
      : [],
  );
  const relatedPosts = editorials
    .filter((p) => {
      const text = `${p.title} ${p.excerpt}`.toLowerCase();
      return venueNames.some((vn) => text.includes(vn));
    })
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: guide.title,
    description: guide.description,
    url: `https://www.rvkfoodie.is/guides/${guide.slug}`,
    offers: {
      "@type": "Offer",
      price: guide.price,
      priceCurrency: "USD",
      url: guide.gumroadUrl,
      availability: "https://schema.org/InStock",
    },
    brand: {
      "@type": "Organization",
      name: "Reykjavik Foodie",
      url: "https://www.rvkfoodie.is",
    },
    ...(totalVenues > 0
      ? {
          keywords: `Reykjavik restaurants, Iceland food guide, ${totalVenues} venues`,
        }
      : {}),
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
        ← All guides
      </a>

      <CmsField fieldApiKey="title" value={guide.title}>
        <h1 className="font-display text-huge leading-huge mb-2">
          {guide.title}
        </h1>
      </CmsField>
      <CmsField fieldApiKey="subtitle" value={guide.subtitle}>
        <p className="text-tiny text-ink-light mb-8">{guide.subtitle}</p>
      </CmsField>

      {introHtml && (
        <CmsText fieldApiKey="intro" value={guide.intro?.value as import("@agent-cms/visual-edit").DastDocument}>
          <div
            className="mb-12 prose-intro"
            dangerouslySetInnerHTML={{ __html: introHtml }}
          />
        </CmsText>
      )}

      {guide.content.map((block) => {
        if (block.blockType === "section") {
          const section = block as SectionBlock;
          const freeVenues = section.venues.filter((v) => v.isFree);
          const gatedVenues = section.venues.filter((v) => !v.isFree);
          return (
            <section key={section.id} className="mb-12">
              <h2 className="font-display text-[1.75rem] leading-tight mb-2 pb-4 border-b border-ink/10">
                {section.title}
              </h2>
              {freeVenues.map((venue) => (
                <VenueCard key={venue.id} {...venue} />
              ))}
              {unlocked
                ? gatedVenues.map((venue) => (
                    <VenueCard key={venue.id} {...venue} />
                  ))
                : gatedVenues.length > 0 && (
                    <p className="py-6 text-ink-light text-tiny italic">
                      +{gatedVenues.length} more in the full guide
                    </p>
                  )}
            </section>
          );
        }
        if (block.blockType === "textBlock") {
          const textBlock = block as TextBlock;
          if (!unlocked && !textBlock.isFree) return null;
          const html = dastToHtml(textBlock.content);
          return (
            <section key={textBlock.id} className="mb-12 prose-custom">
              {textBlock.heading && (
                <h2 className="font-display text-[1.75rem] leading-tight mb-4 pb-4 border-b border-ink/10">
                  {textBlock.heading}
                </h2>
              )}
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </section>
          );
        }
        return null;
      })}

      {!unlocked && totalHidden > 0 && (
        <Paywall
          gumroadUrl={guide.gumroadUrl}
          price={guide.price}
          hiddenCount={totalHidden}
          slug={guide.slug}
          productId={guide.gumroadProductId}
          prefillKey={prefillKey}
          error={error === "invalid_key" ? "invalid" : undefined}
          pending={pending}
        />
      )}

      {unlocked && guide.googleMapsUrl && (
        <div className="mb-12">
          <h2 className="font-display text-[1.75rem] leading-tight mb-4 pb-4 border-b border-ink/10">
            Google Maps
          </h2>
          <a
            href={guide.googleMapsUrl}
            target="_blank"
            rel="noopener"
            className="inline-block bg-blue text-white font-medium px-6 py-2.5 rounded-full text-tiny hover:opacity-90 transition-opacity"
          >
            Open pin list in Google Maps ↗
          </a>
        </div>
      )}

      {otherGuides.length > 0 && (
        <aside className="mt-16 border-t border-ink/10 pt-8">
          <h2 className="font-display text-[1.5rem] leading-tight mb-4">
            More guides
          </h2>
          <div className="flex flex-wrap gap-3">
            {otherGuides.map((g) => (
              <a
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="border border-ink/10 rounded-full px-4 py-1.5 text-tiny hover:border-blue hover:text-blue transition-colors"
              >
                {g.title}
              </a>
            ))}
          </div>
          <p className="mt-4 text-tiny text-ink-light">
            <a
              href="/about"
              className="text-blue hover:opacity-80 transition-opacity"
            >
              About the author →
            </a>
          </p>
        </aside>
      )}

      {relatedPosts.length > 0 && (
        <aside className="mt-12 border-t border-ink/10 pt-8">
          <h2 className="font-display text-[1.5rem] leading-tight mb-4">
            From the blog
          </h2>
          <div className="space-y-4">
            {relatedPosts.map((p) => (
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
                <p className="text-tiny text-ink-light mt-1 line-clamp-2">
                  {p.excerpt}
                </p>
              </a>
            ))}
          </div>
        </aside>
      )}

      <div className="mt-12">
        <RestaurantCallout />
      </div>
    </>
  );

  return (
    <EditWrapper recordId={guide.id} modelApiKey="guide">
      {content}
      <EditBar />
    </EditWrapper>
  );
}
