import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { RestaurantCallout } from "@/app/_components/restaurant-callout";
import {
  getAllGuides,
  getGuidesAndEditorials,
  type Venue,
} from "@/lib/cms";


interface VenueWithContext extends Venue {
  sectionTitle: string;
  guideSlug: string;
  guideTitle: string;
  gumroadUrl: string;
  guidePrice: number;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const allGuides = await getAllGuides();

  for (const guide of allGuides) {
    for (const block of guide.content) {
      if (block.blockType !== "section") continue;
      for (const v of (block).venues) {
        if (v.id === id) {
          const imgUrl = v.image
            ? v.image.url
            : null;
          return {
            title: v.name,
            description: v.description.slice(0, 160),
            alternates: { canonical: `/places/${v.id}` },
            ...(imgUrl
              ? { openGraph: { images: [{ url: imgUrl }] } }
              : {}),
          };
        }
      }
    }
  }

  return {};
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { guides: allGuides, editorials } = await getGuidesAndEditorials();

  let venue: VenueWithContext | null = null;
  let guideVenueCount = 0;
  let guideSectionNames: string[] = [];
  const allVenues: VenueWithContext[] = [];

  for (const guide of allGuides) {
    let venueCountForGuide = 0;
    const sectionNames: string[] = [];
    for (const block of guide.content) {
      if (block.blockType === "section") {
        const section = block;
        sectionNames.push(section.title);
        venueCountForGuide += section.venues.length;
        for (const v of section.venues) {
          const ctx: VenueWithContext = {
            ...v,
            sectionTitle: section.title,
            guideSlug: guide.slug,
            guideTitle: guide.title,
            gumroadUrl: guide.gumroadUrl,
            guidePrice: guide.price,
          };
          allVenues.push(ctx);
          if (v.id === id) {
            venue = ctx;
            guideVenueCount = venueCountForGuide;
            guideSectionNames = sectionNames;
          }
        }
      }
    }
    // Update with final count if this was the matching guide
    if (venue && venue.guideSlug === guide.slug) {
      guideVenueCount = venueCountForGuide;
      guideSectionNames = sectionNames;
    }
  }

  if (!venue) notFound();

  // After the guard above, venue is guaranteed non-null -- bind to a const for narrowing
  const v = venue;

  const mapsUrl =
    v.googleMapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name} ${v.address} Iceland`)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: v.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: v.address,
      addressCountry: "IS",
    },
    description: v.description,
  };

  // Only show free venues in "More in" section -- don't give away paid content
  const nearby = allVenues
    .filter(
      (av) =>
        av.id !== v.id &&
        av.guideSlug === v.guideSlug &&
        av.sectionTitle === v.sectionTitle &&
        av.isFree,
    )
    .slice(0, 3);

  // Find related blog posts that mention this venue by name
  const venueNameLower = venue.name.toLowerCase().replace(/[!?]/g, "");
  const relatedPosts = editorials
    .filter((p) => {
      const text = `${p.title} ${p.excerpt}`.toLowerCase();
      return (
        text.includes(venueNameLower) ||
        venueNameLower
          .split(" ")
          .every((w) => w.length > 3 && text.includes(w))
      );
    })
    .slice(0, 3);

  const venueImgUrl = venue.image
    ? venue.image.url
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <a
        href={`/guides/${venue.guideSlug}`}
        className="text-tiny text-ink-light hover:text-blue transition-colors mb-8 inline-block"
      >
        ← {venue.guideTitle}
      </a>

      <article>
        {venueImgUrl && (
          <div className="mb-8 rounded-2xl overflow-hidden">
            <img
              src={venueImgUrl}
              alt={venue.image?.alt ?? venue.name}
              className="w-full rounded-2xl"
              loading="eager"
            />
          </div>
        )}
        <p className="text-tiny leading-tiny text-blue font-medium tracking-wide uppercase mb-3">
          {venue.sectionTitle}
        </p>
        {venue.bestOfAward && (
          <p className="text-tiny font-medium mb-3">
            {venue.grapevineUrl ? (
              <a
                href={venue.grapevineUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-blue hover:opacity-80 transition-opacity"
              >
                <Icon name="trophy" className="w-4 h-4" />
                {venue.bestOfAward}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-blue">
                <Icon name="trophy" className="w-4 h-4" />
                {venue.bestOfAward}
              </span>
            )}
          </p>
        )}
        <h1 className="font-display text-huge leading-huge mb-2">
          {venue.name}
        </h1>
        {venue.address && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener"
            className="text-tiny text-ink-light hover:text-blue transition-colors inline-block mb-4"
          >
            {venue.address} ↗
          </a>
        )}
        {venue.openingHours && (
          <p className="text-tiny text-ink-light mb-4">{venue.openingHours}</p>
        )}
        {venue.time && (
          <p className="text-tiny text-ink-light mb-4">{venue.time}</p>
        )}
        {(venue.phone ?? venue.website) && (
          <div className="flex gap-4 text-tiny text-ink-light mb-6">
            {venue.phone && <span>{venue.phone}</span>}
            {venue.website && (
              <a
                href={
                  venue.website.startsWith("http")
                    ? venue.website
                    : `https://${venue.website}`
                }
                target="_blank"
                rel="noopener"
                className="text-blue hover:opacity-80 transition-opacity"
              >
                {venue.website}
              </a>
            )}
          </div>
        )}
        <p className="mb-6">{venue.description}</p>
        {venue.note && (
          <p className="text-tiny text-ink-light/70 mb-8">{venue.note}</p>
        )}

        <div className="flex flex-wrap gap-3 mb-12">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener"
            className="inline-block border border-ink/15 rounded-full px-5 py-2 text-tiny hover:border-blue hover:text-blue transition-colors"
          >
            Open in Google Maps ↗
          </a>
        </div>
      </article>

      {/* Guide upsell */}
      <div className="border border-ink/10 rounded-2xl p-8 mb-12">
        <p className="text-tiny text-blue font-medium uppercase tracking-wide mb-2">
          From the {venue.guideTitle}
        </p>
        <h2 className="font-display text-[1.75rem] leading-tight mb-3">
          {venue.name} is one of {guideVenueCount} hand-picked spots
        </h2>
        <p className="text-ink-light mb-2">
          The full guide covers {guideSectionNames.join(", ")} — every
          spot personally vetted by a local.
        </p>
        <p className="text-ink-light mb-6 text-tiny">
          Includes Google Maps pin list and regular updates when places open,
          close, or change.
        </p>
        <a
          href={`/guides/${venue.guideSlug}`}
          className="inline-block bg-blue text-white font-medium px-6 py-2.5 rounded-full text-tiny hover:opacity-90 transition-opacity"
        >
          See the full guide — ${venue.guidePrice}
        </a>
      </div>

      {relatedPosts.length > 0 && (
        <aside className="border-t border-ink/10 pt-8 mb-8">
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
                  {p.date ? new Date(p.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }) : ""}
                </p>
                <h3 className="font-display text-[1.25rem] leading-tight group-hover:text-blue transition-colors">
                  {p.title}
                </h3>
              </a>
            ))}
          </div>
        </aside>
      )}

      {nearby.length > 0 && (
        <aside className="border-t border-ink/10 pt-8">
          <h2 className="font-display text-[1.5rem] leading-tight mb-2">
            Also in {venue.sectionTitle}
          </h2>
          <p className="text-tiny text-ink-light mb-4">
            Free preview from the{" "}
            <a
              href={`/guides/${venue.guideSlug}`}
              className="text-blue hover:opacity-80 transition-opacity"
            >
              {venue.guideTitle}
            </a>
          </p>
          <div className="space-y-4">
            {nearby.map((nv) => (
              <a
                key={nv.id}
                href={`/places/${nv.id}`}
                className="block border border-ink/10 rounded-xl p-5 hover:border-ink/25 transition-colors group"
              >
                <h3 className="font-display text-[1.25rem] leading-tight group-hover:text-blue transition-colors">
                  {nv.name}
                </h3>
                {nv.address && (
                  <p className="text-tiny text-ink-light mt-1">{nv.address}</p>
                )}
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
}
