import { getCmsHandler } from "@/lib/cms-handler";
import { env } from "cloudflare:workers";
import { print } from "graphql";
import { graphql } from "gql.tada";

/**
 * Diagnostic endpoint — traces GraphQL query waterfall.
 * Compares raw D1, fast-path eligible, and full Yoga queries.
 */

const simpleDefs = {
  home: graphql(`query HomePage { homePage { id headline headlineEmphasis subtext bundleTitle bundlePrice } }`),
  settings: graphql(`query SiteSettings { siteSettings { id defaultMetaDescription changelogSubtitle } }`),
  guidesFlat: graphql(`query AllGuidesFlat { allGuides { id title slug subtitle description price gumroadProductId gumroadUrl } }`),
  editorialsFlat: graphql(`query AllEditorialsFlat { allEditorials { id title slug excerpt date } }`),
};

const fullDefs = {
  guidesFull: graphql(`query AllGuides { allGuides { id title slug content { value blocks { __typename ... on SectionRecord { id title venues { value blocks { __typename ... on VenueRecord { id name address description image { id url } } } } } ... on TextBlockRecord { id heading content { value } } } } } }`),
  editorialsFull: graphql(`query AllEditorials { allEditorials { id title slug excerpt date image { id url alt } content { value blocks { __typename ... on ImageBlockRecord { id image { id url } caption } } } } }`),
};

export async function GET() {
  const cms = getCmsHandler();
  const db = env.DB;

  // 1. Raw D1 queries — baseline for D1 latency
  const raw: Record<string, number> = {};

  const rawT0 = performance.now();
  await db.prepare("SELECT 1").first();
  raw["SELECT 1"] = ms(rawT0);

  const rawT1 = performance.now();
  await db.prepare("SELECT count(*) FROM models").first();
  raw["count models"] = ms(rawT1);

  const rawT2 = performance.now();
  await db.prepare("SELECT * FROM content_home_page LIMIT 1").first();
  raw["home row"] = ms(rawT2);

  const rawT3 = performance.now();
  await db.prepare("SELECT _published_snapshot FROM content_guide").all();
  raw["guide snapshots"] = ms(rawT3);

  const rawT4 = performance.now();
  await db.prepare("SELECT _published_snapshot FROM content_editorial").all();
  raw["editorial snapshots"] = ms(rawT4);

  // 2. Warm schema
  const schemaT0 = performance.now();
  await cms.execute("{ __typename }");
  const schemaWarmMs = ms(schemaT0);

  // 3. Simple queries (fast-path eligible)
  const simple: Record<string, number> = {};
  for (const [name, doc] of Object.entries(simpleDefs)) {
    const t0 = performance.now();
    await cms.execute(print(doc));
    simple[name] = ms(t0);
  }

  // 4. Full queries (Yoga fallback)
  const full: Record<string, number> = {};
  for (const [name, doc] of Object.entries(fullDefs)) {
    const t0 = performance.now();
    await cms.execute(print(doc));
    full[name] = ms(t0);
  }

  // 5. Page simulations
  const pageHomeSimpleT0 = performance.now();
  await Promise.all([
    cms.execute(print(simpleDefs.home)),
    cms.execute(print(simpleDefs.guidesFlat)),
    cms.execute(print(simpleDefs.editorialsFlat)),
  ]);
  const pageHomeSimpleMs = ms(pageHomeSimpleT0);

  const pageHomeFullT0 = performance.now();
  await Promise.all([
    cms.execute(print(simpleDefs.home)),
    cms.execute(print(fullDefs.guidesFull)),
    cms.execute(print(fullDefs.editorialsFull)),
  ]);
  const pageHomeFullMs = ms(pageHomeFullT0);

  return new Response(
    JSON.stringify({
      rawD1: raw,
      schemaWarmMs,
      simple,
      full,
      pageSimulation: { homeSimple: pageHomeSimpleMs, homeFull: pageHomeFullMs },
      analysis: {
        d1Latency: `${raw["SELECT 1"]}ms per round-trip`,
        fastPathOverhead: `${Math.round(simple.home - raw["SELECT 1"])}ms over raw D1`,
        yogaOverhead: `${Math.round(full.guidesFull - simple.guidesFlat)}ms for structured text resolution`,
      },
    }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
}

function ms(t0: number) {
  return Number((performance.now() - t0).toFixed(1));
}
