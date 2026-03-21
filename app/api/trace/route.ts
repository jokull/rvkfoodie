import { getCmsHandler } from "@/lib/cms-handler";
import { env } from "cloudflare:workers";

/**
 * Diagnostic: trace exactly what happens on the homepage.
 * Calls execute() directly and reads _trace from the response.
 */

export async function GET() {
  const db = env.DB;
  const cms = getCmsHandler();

  // 1. Raw D1 baseline
  const d1t0 = performance.now();
  await db.prepare("SELECT 1").first();
  const d1Latency = ms(d1t0);

  // 2. Warm schema
  const warmT0 = performance.now();
  await cms.execute("{ __typename }");
  const schemaWarmMs = ms(warmT0);

  // 3. The actual combined homepage query
  const combinedQuery = `query HomePageData {
    homePage { id headline headlineEmphasis subtext bundleTitle bundleDescription bundlePrice bundleGumroadUrl authorBlurb }
    allGuides(orderBy: [price_DESC]) {
      id title slug subtitle description price gumroadProductId gumroadUrl googleMapsUrl
      intro { value }
      content { value blocks { __typename ... on SectionRecord { id title venues { value blocks { __typename ... on VenueRecord { id name address description note time isFree location { latitude longitude } openingHours googleMapsUrl website phone bestOfAward grapevineUrl image { id url alt width height } } } } } ... on TextBlockRecord { id heading isFree content { value } } } }
    }
    allEditorials(orderBy: [date_DESC]) {
      id title slug excerpt date
      image { id url alt width height }
      content { value blocks { __typename ... on ImageBlockRecord { id image { id url alt width height } caption } } }
    }
  }`;

  const cmsT0 = performance.now();
  const combinedResult: Record<string, unknown> = await cms.execute(combinedQuery);
  const cmsMs = ms(cmsT0);
  // _trace is on the execute() result object, not on .data
  const combinedTrace = combinedResult._trace;
  const combinedKeys = Object.keys(combinedResult);

  // 4. Individual queries for comparison
  const homeT0 = performance.now();
  const homeResult = await cms.execute(`query HP { homePage { id headline headlineEmphasis subtext bundleTitle bundlePrice } }`);
  const homeMs = ms(homeT0);
  const homeTrace = (homeResult as Record<string, unknown>)._trace;

  const guidesT0 = performance.now();
  const guidesResult = await cms.execute(`query AG { allGuides(orderBy: [price_DESC]) { id title slug subtitle description price gumroadProductId gumroadUrl googleMapsUrl intro { value } content { value blocks { __typename ... on SectionRecord { id title venues { value blocks { __typename ... on VenueRecord { id name address description note time isFree location { latitude longitude } openingHours googleMapsUrl website phone bestOfAward grapevineUrl image { id url alt width height } } } } } ... on TextBlockRecord { id heading isFree content { value } } } } } }`);
  const guidesMs = ms(guidesT0);
  const guidesTrace = (guidesResult as Record<string, unknown>)._trace;

  const editorialsT0 = performance.now();
  const editorialsResult = await cms.execute(`query AE { allEditorials(orderBy: [date_DESC]) { id title slug excerpt date image { id url alt width height } content { value blocks { __typename ... on ImageBlockRecord { id image { id url alt width height } caption } } } } }`);
  const editorialsMs = ms(editorialsT0);
  const editorialsTrace = (editorialsResult as Record<string, unknown>)._trace;

  // 5. Flat queries (definitely fast-path)
  const flatT0 = performance.now();
  const flatResult = await cms.execute(`query Flat { homePage { id headline } allGuides { id title slug price } allEditorials { id title slug date } }`);
  const flatMs = ms(flatT0);
  const flatTrace = (flatResult as Record<string, unknown>)._trace;

  return Response.json({
    d1Latency,
    schemaWarmMs,
    combinedHomepage: {
      totalMs: cmsMs,
      resultKeys: combinedKeys,
      trace: combinedTrace ?? "no _trace",
    },
    individual: {
      homePage: { ms: homeMs, trace: homeTrace ?? "no _trace" },
      allGuides: { ms: guidesMs, trace: guidesTrace ?? "no _trace" },
      allEditorials: { ms: editorialsMs, trace: editorialsTrace ?? "no _trace" },
    },
    flat: {
      totalMs: flatMs,
      trace: flatTrace ?? "no _trace",
    },
    analysis: {
      combinedPath: typeof combinedTrace === "object" && combinedTrace !== null ? (combinedTrace as Record<string, unknown>).path : "unknown",
      individualPaths: {
        home: typeof homeTrace === "object" && homeTrace !== null ? (homeTrace as Record<string, unknown>).path : "unknown",
        guides: typeof guidesTrace === "object" && guidesTrace !== null ? (guidesTrace as Record<string, unknown>).path : "unknown",
        editorials: typeof editorialsTrace === "object" && editorialsTrace !== null ? (editorialsTrace as Record<string, unknown>).path : "unknown",
        flat: typeof flatTrace === "object" && flatTrace !== null ? (flatTrace as Record<string, unknown>).path : "unknown",
      },
    },
  }, { headers: { "Content-Type": "application/json" } });
}

function ms(t0: number) {
  return Number((performance.now() - t0).toFixed(1));
}
