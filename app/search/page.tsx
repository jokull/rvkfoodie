import type { Metadata } from "next";
import { Icon } from "@/app/_components/icon";
import { getGuidesAndEditorials, venueUrl, type Venue } from "@/lib/cms";


export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

const CMS_URL = "https://rvkfoodie-agent-cms.solberg.workers.dev";

interface SearchResult {
  type: "venue" | "editorial" | "guide";
  title: string;
  subtitle: string;
  url: string;
  image?: string;
  badge?: string;
  score?: number;
}

const examples = [
  "dinner reservations",
  "best bakery",
  "cocktail bars",
  "golden circle stops",
  "tapas wine",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const query = rawQ?.trim() ?? "";

  let results: SearchResult[] = [];

  if (query.length >= 2) {
    const q = query.toLowerCase();
    const { guides, editorials } = await getGuidesAndEditorials();

    // Build lookup maps
    const guideById = new Map(guides.map((g) => [g.id, g]));
    const editorialById = new Map(editorials.map((e) => [e.id, e]));
    const venueMap = new Map<
      string,
      {
        venue: Venue;
        section: string;
        guide: (typeof guides)[0];
      }
    >();
    for (const guide of guides) {
      for (const block of guide.content) {
        if (block.blockType !== "section") continue;
        for (const venue of block.venues) {
          venueMap.set(venue.id, { venue, section: block.title, guide });
        }
      }
    }

    // Try semantic search first
    let semanticResults: {
      recordId: string;
      modelApiKey: string;
      rank: number;
    }[] = [];
    try {
      const res = await fetch(`${CMS_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode: "semantic", first: 20 }),
      });
      if (res.ok) {
        const data: { results: typeof semanticResults } = await res.json();
        semanticResults = data.results ?? [];
      }
    } catch {
      // Semantic search failed, fall through to client-side
    }

    // Hydrate semantic results
    if (semanticResults.length > 0) {
      for (const sr of semanticResults) {
        if (sr.modelApiKey === "guide") {
          const guide = guideById.get(sr.recordId);
          if (guide) {
            results.push({
              type: "guide",
              title: guide.title,
              subtitle: guide.description,
              url: `/guides/${guide.slug}`,
              score: sr.rank,
            });
          }
        } else if (sr.modelApiKey === "editorial") {
          const ed = editorialById.get(sr.recordId);
          if (ed) {
            results.push({
              type: "editorial",
              title: ed.title ?? "",
              subtitle: ed.excerpt ?? "",
              url: `/blog/${ed.slug}`,
              image: ed.image?.responsiveImage?.src ?? ed.image?.url ?? undefined,
              score: sr.rank,
            });
          }
        }
      }
    }

    // Always add client-side venue search (venues aren't indexed in Vectorize)
    for (const [, { venue, section, guide }] of venueMap) {
      const text =
        `${venue.name} ${venue.address} ${venue.description} ${venue.bestOfAward ?? ""}`.toLowerCase();
      if (text.includes(q)) {
        results.push({
          type: "venue",
          title: venue.name,
          subtitle: `${venue.address} · ${section} · ${guide.title}`,
          url: venueUrl(venue),
          image: venue.image?.responsiveImage?.src ?? venue.image?.url ?? undefined,
          badge: venue.bestOfAward ?? undefined,
        });
      }
    }

    // Fallback: if no semantic results, do full client-side search on editorials/guides too
    if (semanticResults.length === 0) {
      for (const ed of editorials) {
        const text = `${ed.title} ${ed.excerpt}`.toLowerCase();
        if (text.includes(q)) {
          results.push({
            type: "editorial",
            title: ed.title ?? "",
            subtitle: ed.excerpt ?? "",
            url: `/blog/${ed.slug}`,
            image: ed.image?.responsiveImage?.src ?? ed.image?.url ?? undefined,
          });
        }
      }
      for (const guide of guides) {
        const text =
          `${guide.title} ${guide.subtitle} ${guide.description}`.toLowerCase();
        if (text.includes(q)) {
          results.push({
            type: "guide",
            title: guide.title,
            subtitle: guide.description,
            url: `/guides/${guide.slug}`,
          });
        }
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    results = results.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  return (
    <div className="mb-12">
      <h1 className="font-display text-huge leading-huge mb-6">Search</h1>

      <form method="GET" action="/search" className="relative mb-8">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search venues, blog posts, guides..."
          autoFocus
          className="w-full border border-ink/15 rounded-2xl px-6 py-4 text-normal bg-white focus:outline-none focus:border-blue placeholder:text-ink/30 pr-14"
        />
        <button
          type="submit"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-blue hover:opacity-80 transition-opacity"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      </form>

      {!query && (
        <div className="text-tiny text-ink-light">
          <p className="mb-3">Try searching for:</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <a
                key={ex}
                href={`/search?q=${encodeURIComponent(ex)}`}
                className="border border-ink/10 rounded-full px-4 py-1.5 hover:border-blue hover:text-blue transition-colors"
              >
                {ex}
              </a>
            ))}
          </div>
        </div>
      )}

      {query && results.length === 0 && (
        <p className="text-ink-light">
          No results for &ldquo;{query}&rdquo;. Try a different search term.
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          <p className="text-tiny text-ink-light mb-4">
            {results.length} result{results.length !== 1 ? "s" : ""} for
            &ldquo;{query}&rdquo;
          </p>
          {results.map((r) => (
            <a
              key={r.url}
              href={r.url}
              className="flex gap-4 items-start p-4 -mx-4 rounded-xl hover:bg-ink/[0.03] transition-colors group"
            >
              {r.image && (
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                  <img
                    src={r.image}
                    alt={r.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-tiny text-blue font-medium uppercase tracking-wide">
                    {r.type === "venue"
                      ? "Venue"
                      : r.type === "editorial"
                        ? "Blog"
                        : "Guide"}
                  </span>
                  {r.badge && (
                    <span className="inline-flex items-center gap-1 text-tiny text-blue">
                      <Icon name="trophy" className="w-3 h-3" />
                      {r.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-display text-[1.25rem] leading-tight group-hover:text-blue transition-colors">
                  {r.title}
                </h3>
                <p className="text-tiny text-ink-light mt-1 line-clamp-1">
                  {r.subtitle}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
