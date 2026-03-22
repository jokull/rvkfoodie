import type { Metadata } from "next";

import { getAboutPageData } from "@/lib/cms";
import { seoTagsToMetadata } from "@/lib/seo";
import { dastToHtml } from "@/lib/dast";
import { RestaurantCallout } from "@/app/_components/restaurant-callout";
import { EditWrapper, EditBar, CmsField, CmsText } from "@/app/_components/visual-edit";

export async function generateMetadata(): Promise<Metadata> {
  const { about } = await getAboutPageData();
  return {
    ...seoTagsToMetadata(about._seoMetaTags),
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const { about, guides } = await getAboutPageData();
  const bioHtml = about.bio ? dastToHtml(about.bio) : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Reykjavík Foodie",
    url: "https://www.rvkfoodie.is/about",
    sameAs: ["https://instagram.com/rvkfoodie"],
  };

  const content = (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CmsField fieldApiKey="title" value={about.title ?? ""}>
        <h1 className="font-display text-huge leading-huge mb-8">
          {about.title}
        </h1>
      </CmsField>

      <div className="mb-10">
        <img
          src="/about.jpg"
          alt="Reykjavík Foodie"
          className="w-48 rounded-2xl object-cover shadow-2xl shadow-ink/20"
        />
      </div>

      <CmsText fieldApiKey="bio" value={about.bio?.value}>
        <div
          className="space-y-6 mb-16 prose-about"
          dangerouslySetInnerHTML={{ __html: bioHtml }}
        />
      </CmsText>

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

  return (
    <EditWrapper recordId={about.id} modelApiKey="about_page">
      {content}
      <EditBar />
    </EditWrapper>
  );
}
