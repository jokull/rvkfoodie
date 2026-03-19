import type { Metadata } from "next";
import { getAllGuides, getAboutPage } from "@/lib/cms";
import { dastToHtml } from "@/lib/dast";
import { RestaurantCallout } from "@/app/_components/restaurant-callout";

export async function generateMetadata(): Promise<Metadata> {
  const about = await getAboutPage();
  return {
    title: about.title,
    description: about.metaDescription,
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const [guides, about] = await Promise.all([getAllGuides(), getAboutPage()]);
  const bioHtml = about.bio ? dastToHtml(about.bio) : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Reykjavík Foodie",
    url: "https://www.rvkfoodie.is/about",
    sameAs: ["https://instagram.com/rvkfoodie"],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="font-display text-huge leading-huge mb-8">{about.title}</h1>

      <div className="mb-10">
        <img
          src="/about.jpg"
          alt="Reykjavík Foodie"
          className="w-48 rounded-2xl object-cover shadow-2xl shadow-ink/20"
        />
      </div>

      <div
        className="space-y-6 mb-16 prose-about"
        dangerouslySetInnerHTML={{ __html: bioHtml }}
      />

      <section className="border-t border-ink/10 pt-8">
        <h2 className="font-display text-[1.75rem] leading-tight mb-6">
          The guides
        </h2>
        <div className="space-y-4">
          {guides.map((guide) => (
            <a
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="flex items-center justify-between border border-ink/10 rounded-xl p-5 hover:border-ink/25 transition-colors group"
            >
              <div>
                <h3 className="font-display text-[1.25rem] leading-tight group-hover:text-blue transition-colors">
                  {guide.title}
                </h3>
                <p className="text-tiny text-ink-light mt-1">
                  {guide.subtitle}
                </p>
              </div>
              <span className="text-tiny text-ink-light">${guide.price}</span>
            </a>
          ))}
        </div>
      </section>

      <div className="mt-12">
        <RestaurantCallout />
      </div>
    </>
  );
}
