import { getCmsHandler } from "@/lib/cms-handler";
import { env } from "cloudflare:workers";

/**
 * Diagnostic: waterfall trace comparing fast-path vs Yoga for real queries.
 */

const editorialsFullQuery = `query AllEditorials {
  allEditorials(orderBy: [date_DESC]) {
    id title slug excerpt date
    image { id url alt width height }
    content { value blocks { __typename ... on ImageBlockRecord { id image { id url alt width height } caption } } }
  }
}`;

const homePageCombinedQuery = `query HomePageData {
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

async function traceViaHttp(label: string, query: string, headers: Record<string, string> = {}) {
  const cms = getCmsHandler();
  const t0 = performance.now();
  const response = await cms.fetch(
    new Request("http://localhost/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.CMS_WRITE_KEY}`,
        ...headers,
      },
      body: JSON.stringify({ query }),
    }),
  );
  const body = await response.text();
  const elapsed = ms(t0);
  const h: Record<string, string> = {};
  response.headers.forEach((v, k) => { if (k.startsWith("x-") || k === "server-timing") h[k] = v; });
  return { label, elapsed, status: response.status, headers: h, bodyLength: body.length };
}

async function traceViaExecute(label: string, query: string) {
  const cms = getCmsHandler();
  const t0 = performance.now();
  const result = await cms.execute(query);
  const elapsed = ms(t0);
  const hasData = result.data !== null && result.data !== undefined;
  const hasErrors = (result.errors?.length ?? 0) > 0;
  return { label, elapsed, hasData, hasErrors, errors: result.errors?.map(e => e.message) };
}

export async function GET() {
  const db = env.DB;

  // Raw D1 baseline
  const d1t0 = performance.now();
  await db.prepare("SELECT 1").first();
  const d1Latency = ms(d1t0);

  // Warm schema + fast path metadata
  const cms = getCmsHandler();
  await cms.execute("{ __typename }");

  // --- Via execute() (uses fast path if available) ---
  const execEditorials = await traceViaExecute("editorialsFull via execute()", editorialsFullQuery);
  const execCombined = await traceViaExecute("homePageCombined via execute()", homePageCombinedQuery);

  // --- Via HTTP with X-Bench-Trace:1 (forces Yoga, gets SQL metrics) ---
  const yogaEditorials = await traceViaHttp("editorialsFull via Yoga", editorialsFullQuery, { "X-Bench-Trace": "1" });
  const yogaCombined = await traceViaHttp("homePageCombined via Yoga", homePageCombinedQuery, { "X-Bench-Trace": "1" });

  // --- Via HTTP without trace header (goes through fast path if matched) ---
  const fpEditorials = await traceViaHttp("editorialsFull via HTTP (fast path?)", editorialsFullQuery);
  const fpCombined = await traceViaHttp("homePageCombined via HTTP (fast path?)", homePageCombinedQuery);

  return Response.json({
    d1Latency,
    execute: { execEditorials, execCombined },
    yoga: { yogaEditorials, yogaCombined },
    fastPathHttp: { fpEditorials, fpCombined },
    comparison: {
      editorials: {
        execute: execEditorials.elapsed,
        yoga: yogaEditorials.elapsed,
        httpFastPath: fpEditorials.elapsed,
        yogaSqlStatements: yogaEditorials.headers["x-sql-statement-count"],
        yogaSqlTotalMs: yogaEditorials.headers["x-sql-total-ms"],
        httpFpSqlStatements: fpEditorials.headers["x-sql-statement-count"] ?? "n/a (fast path)",
      },
      combined: {
        execute: execCombined.elapsed,
        yoga: yogaCombined.elapsed,
        httpFastPath: fpCombined.elapsed,
        yogaSqlStatements: yogaCombined.headers["x-sql-statement-count"],
        yogaSqlTotalMs: yogaCombined.headers["x-sql-total-ms"],
        httpFpSqlStatements: fpCombined.headers["x-sql-statement-count"] ?? "n/a (fast path)",
      },
    },
  }, { headers: { "Content-Type": "application/json" } });
}

function ms(t0: number) {
  return Number((performance.now() - t0).toFixed(1));
}
