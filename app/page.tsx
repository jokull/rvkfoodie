import {
  getAllGuides,
  getAllEditorials,
  getHomePage,
  type Editorial,
} from "@/lib/cms";
import { mediaUrl } from "@/lib/images";
import { getSessionData } from "@/lib/session";
import { Icon } from "@/app/_components/icon";

const collageCards = [
  { x: -280, y: 10, rot: "-6deg", z: 4, w: 150 },
  { x: -150, y: 100, rot: "4deg", z: 7, w: 135 },
  { x: -50, y: 0, rot: "7deg", z: 3, w: 165 },
  { x: 60, y: 85, rot: "-3deg", z: 8, w: 150 },
  { x: 140, y: -5, rot: "-5deg", z: 5, w: 155 },
  { x: 260, y: 90, rot: "6deg", z: 6, w: 135 },
  { x: -200, y: 190, rot: "3deg", z: 1, w: 120 },
  { x: 170, y: 185, rot: "-4deg", z: 2, w: 125 },
];

const guideIcon: Record<
  string,
  "utensils" | "cocktail" | "map-pin" | "book-open"
> = {
  "food-guide": "utensils",
  "bar-crawl": "cocktail",
  "golden-circle": "map-pin",
};

export default async function HomePage() {
  const [guides, editorials, home, unlockedProducts] = await Promise.all([
    getAllGuides(),
    getAllEditorials(),
    getHomePage(),
    getSessionData<string[]>("unlockedProducts").then((v) => v ?? []),
  ]);

  const collagePhotos = editorials
    .filter(
      (p): p is Editorial & { image: NonNullable<Editorial["image"]> } =>
        !!p.image,
    )
    .slice(0, 8);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Reykjavík Foodie",
    url: "https://www.rvkfoodie.is",
    description: "Honest food guides for Reykjavík and beyond.",
    publisher: {
      "@type": "Organization",
      name: "Reykjavík Foodie",
      url: "https://www.rvkfoodie.is",
      sameAs: ["https://instagram.com/rvkfoodie"],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-12">
        <h1 className="font-display text-huge leading-huge mb-6">
          {home.headline}
          <br />
          {home.headlineEmphasis && <em>{home.headlineEmphasis}</em>}
        </h1>
        <p className="text-ink-light max-w-md">{home.subtext}</p>
      </div>

      {collagePhotos.length > 0 && (
        <div className="relative h-56 sm:h-[22rem] mb-16 -mx-6 sm:mx-0 overflow-hidden sm:overflow-visible">
          <div className="absolute inset-0 origin-top scale-[0.55] sm:scale-100">
            {collagePhotos.map((photo, i) => {
              const card = collageCards[i];
              if (!card) return null;
              const imgUrl = mediaUrl(
                photo.image.filename || photo.image.url,
              );
              return (
                <div
                  key={photo.id}
                  className="absolute rounded-2xl overflow-hidden shadow-lg border-4 border-cream"
                  style={{
                    left: `calc(50% + ${card.x}px)`,
                    top: card.y,
                    width: card.w,
                    height: card.w,
                    marginLeft: -card.w / 2,
                    transform: `rotate(${card.rot})`,
                    zIndex: card.z,
                  }}
                >
                  <img
                    src={imgUrl}
                    alt={photo.image.alt || photo.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section className="mb-8">
        <h2 className="font-display text-[1.75rem] leading-tight mb-6 pb-4 border-b border-ink/10">
          The guides
        </h2>
        <div className="space-y-4">
          {guides.map((guide) => (
            <a
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="block border border-ink/10 rounded-2xl overflow-hidden hover:border-ink/25 transition-colors group"
            >
              <div className="p-8">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3">
                    <Icon
                      name={guideIcon[guide.slug] || "book-open"}
                      className="w-7 h-7 text-blue shrink-0"
                    />
                    <h3 className="font-display text-[1.75rem] leading-tight group-hover:text-blue transition-colors">
                      {guide.title}
                    </h3>
                  </div>
                  {unlockedProducts.includes(guide.gumroadProductId) ? (
                    <span className="text-tiny text-blue font-medium whitespace-nowrap mt-2">
                      Unlocked
                    </span>
                  ) : (
                    <span className="text-tiny text-ink-light whitespace-nowrap mt-2">
                      ${guide.price}
                    </span>
                  )}
                </div>
                <p className="text-tiny leading-tiny text-ink-light mb-2 ml-12">
                  {guide.subtitle}
                </p>
                <p className="text-ink-light ml-12">{guide.description}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <div className="border border-ink/10 rounded-2xl p-8 mb-20">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="font-display text-[1.75rem] leading-tight">
            {home.bundleTitle}
          </h2>
          <span className="text-tiny text-ink-light whitespace-nowrap mt-1">
            ${home.bundlePrice}
          </span>
        </div>
        <p className="text-ink-light mb-4">{home.bundleDescription}</p>
        <a
          href={`/api/checkout?slug=food-guide&url=${encodeURIComponent(home.bundleGumroadUrl)}`}
          className="inline-block bg-blue text-white font-medium px-6 py-2.5 rounded-full text-tiny hover:opacity-90 transition-opacity"
        >
          Get the bundle — ${home.bundlePrice}
        </a>
      </div>

      {editorials.length > 0 && (
        <section className="mb-16">
          <h2 className="font-display text-[1.75rem] leading-tight mb-6 pb-4 border-b border-ink/10">
            From the blog
          </h2>
          <div className="space-y-6">
            {editorials.map((post) => {
              const imgUrl = post.image
                ? mediaUrl(post.image.filename || post.image.url)
                : null;
              return (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="flex gap-5 group items-start"
                >
                  {imgUrl && (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden shrink-0">
                      <img
                        src={imgUrl}
                        alt={post.image?.alt || post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-tiny text-ink-light mb-1">
                      {new Date(post.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <h3 className="font-display text-[1.5rem] leading-tight group-hover:text-blue transition-colors mb-2">
                      {post.title}
                    </h3>
                    <p className="text-ink-light line-clamp-2 text-tiny">
                      {post.excerpt}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="border-t border-ink/10 pt-8">
        <div className="flex items-center gap-4">
          <img
            src="/about.jpg"
            alt="Reykjavík Foodie"
            className="w-14 h-18 rounded-lg object-cover"
            loading="lazy"
          />
          <p className="text-ink-light">
            {home.authorBlurb}{" "}
            <a
              href="/about"
              className="text-blue hover:opacity-80 transition-opacity"
            >
              Read more &rarr;
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
