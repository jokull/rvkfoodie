import { getCmsHandler } from "@/lib/cms-handler";
import { print } from "graphql";
import { graphql } from "gql.tada";

/**
 * Diagnostic endpoint — traces GraphQL query waterfall.
 * Measures total time, schema build, and per-query timings.
 *
 * Usage: /api/trace?t=home|guides|editorials|page-home|page-guide
 */

const queryDefs = {
  home: graphql(`query HomePage { homePage { id headline } }`),
  settings: graphql(`query SiteSettings { siteSettings { id defaultMetaDescription } }`),
  guides: graphql(`query AllGuides { allGuides { id title slug content { value blocks { __typename ... on SectionRecord { id title venues { value blocks { __typename ... on VenueRecord { id name address description image { id url } } } } } ... on TextBlockRecord { id heading content { value } } } } } }`),
  editorials: graphql(`query AllEditorials { allEditorials { id title slug excerpt date image { id url alt } content { value blocks { __typename ... on ImageBlockRecord { id image { id url } caption } } } } }`),
  changelog: graphql(`query Changelog { allChangelogEntries { id date title changeType guide { id title slug } } }`),
  guideBySlug: graphql(`query GuideBySlug { guide(filter: { slug: { eq: "food-guide" } }) { id title slug content { value blocks { __typename ... on SectionRecord { id title venues { value blocks { __typename ... on VenueRecord { id name address description image { id url } } } } } ... on TextBlockRecord { id heading content { value } } } } } }`),
};

export async function GET() {
  const cms = getCmsHandler();

  // Warm up schema
  const schemaT0 = performance.now();
  await cms.execute("{ __typename }");
  const schemaWarmMs = ms(schemaT0);

  // Trace individual queries
  const results: Record<string, { ms: number; rowCount: number }> = {};
  for (const [name, doc] of Object.entries(queryDefs)) {
    const query = print(doc);
    const t0 = performance.now();
    const result = await cms.execute(query);
    const elapsed = ms(t0);
    const data = result.data as Record<string, unknown>;
    const firstKey = Object.keys(data)[0];
    const val = data[firstKey];
    const rowCount = Array.isArray(val) ? val.length : val ? 1 : 0;
    results[name] = { ms: elapsed, rowCount };
  }

  // Simulate page-home: 3 parallel queries
  const pageHomeT0 = performance.now();
  const [r1, r2, r3] = await Promise.all([
    timed(() => cms.execute(print(queryDefs.home))),
    timed(() => cms.execute(print(queryDefs.guides))),
    timed(() => cms.execute(print(queryDefs.editorials))),
  ]);
  const pageHomeTotalMs = ms(pageHomeT0);

  // Simulate page-guide: 3 parallel queries
  const pageGuideT0 = performance.now();
  const [g1, g2, g3] = await Promise.all([
    timed(() => cms.execute(print(queryDefs.guideBySlug))),
    timed(() => cms.execute(print(queryDefs.guides))),
    timed(() => cms.execute(print(queryDefs.editorials))),
  ]);
  const pageGuideTotalMs = ms(pageGuideT0);

  return new Response(
    JSON.stringify(
      {
        placement: "check cf-placement header",
        schemaWarmMs,
        individual: results,
        pageHome: {
          totalMs: pageHomeTotalMs,
          queries: { home: r1.ms, guides: r2.ms, editorials: r3.ms },
          slowest: Math.max(r1.ms, r2.ms, r3.ms),
          note: "3 queries in parallel — total ≈ slowest",
        },
        pageGuide: {
          totalMs: pageGuideTotalMs,
          queries: { guideBySlug: g1.ms, allGuides: g2.ms, editorials: g3.ms },
          slowest: Math.max(g1.ms, g2.ms, g3.ms),
        },
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/json" } },
  );
}

function ms(t0: number) {
  return Number((performance.now() - t0).toFixed(1));
}

async function timed<T>(fn: () => Promise<T>) {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: ms(t0) };
}
