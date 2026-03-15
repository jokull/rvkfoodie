#!/usr/bin/env node

/**
 * Restaurant lookup script - finds coordinates, opening hours, and map links
 * for restaurants in Reykjavík using free APIs (no API key required).
 *
 * APIs used:
 *   1. Nominatim (geocoding) - https://nominatim.openstreetmap.org
 *   2. Overpass API (OSM data) - https://overpass-api.de
 *
 * Usage: node scripts/lookup-restaurant.mjs
 */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OVERPASS_BASE = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "rvkfoodie-research/1.0 (jokull@solberg.is)";

// Reykjavík bounding box (generous)
const RVK_BBOX = { south: 63.9, north: 64.2, west: -22.1, east: -21.7 };

/**
 * Strategy 1: Overpass API - search by name pattern within Reykjavík bbox.
 * This returns full OSM tags including opening_hours.
 */
async function searchOverpass(namePattern) {
  // Escape regex special chars but keep basic letters
  const escaped = namePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const query = `[out:json][timeout:10];
(
  node[name~"${escaped}",i](${RVK_BBOX.south},${RVK_BBOX.west},${RVK_BBOX.north},${RVK_BBOX.east});
  way[name~"${escaped}",i](${RVK_BBOX.south},${RVK_BBOX.west},${RVK_BBOX.north},${RVK_BBOX.east});
);
out center;`;

  const url = `${OVERPASS_BASE}?data=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = await res.json();
  return data.elements || [];
}

/**
 * Strategy 2: Nominatim geocoding - search by name + address.
 * Returns coordinates and structured address but NOT opening hours.
 */
async function searchNominatim(query) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "3",
    countrycodes: "is",
  });
  const url = `${NOMINATIM_BASE}/search?${params}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return res.json();
}

/**
 * Strategy 3: Overpass lookup by OSM node/way ID.
 * Used to fetch full tags (opening_hours) when Nominatim gives us an OSM ID.
 */
async function fetchOsmElement(osmType, osmId) {
  const typeMap = { node: "node", way: "way", relation: "relation" };
  const t = typeMap[osmType];
  if (!t) return null;
  const query = `[out:json][timeout:10];${t}(${osmId});out;`;
  const url = `${OVERPASS_BASE}?data=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.elements?.[0] || null;
}

function mapsUrl(lat, lon) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function osmUrl(osmType, osmId) {
  return `https://www.openstreetmap.org/${osmType}/${osmId}`;
}

function osmUrlFromCoords(lat, lon) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
}

/**
 * Main lookup: combines Overpass name search with Nominatim fallback.
 * Returns structured result with coordinates, hours, and links.
 */
async function lookupRestaurant(name, address) {
  const searchTerm = `${name} ${address} Reykjavik`;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Looking up: ${name} — ${address}`);
  console.log("=".repeat(60));

  // Use the full name for Overpass search (strip punctuation)
  const cleanName = name.replace(/[!?.,]/g, "").trim();

  // Run both searches in parallel
  const [overpassResults, nominatimResults] = await Promise.all([
    searchOverpass(cleanName).catch((e) => {
      console.log(`  Overpass error: ${e.message}`);
      return [];
    }),
    searchNominatim(searchTerm).catch((e) => {
      console.log(`  Nominatim error: ${e.message}`);
      return [];
    }),
  ]);

  console.log(
    `  Overpass: ${overpassResults.length} results, Nominatim: ${nominatimResults.length} results`
  );

  // --- Try to find best match from Overpass (has opening_hours) ---
  // Filter to amenity/shop nodes and score by name similarity
  const amenityTypes = [
    "restaurant",
    "cafe",
    "bar",
    "bakery",
    "fast_food",
    "pub",
  ];
  const isFoodPlace = (el) => {
    const amenity = el.tags?.amenity;
    const shop = el.tags?.shop;
    return (
      amenityTypes.includes(amenity) ||
      amenityTypes.includes(shop) ||
      shop === "bakery"
    );
  };
  // Score: how well does the OSM name match our search name?
  const nameLower = name.toLowerCase().replace(/[!?.,]/g, "");
  const scoreMatch = (el) => {
    const osmName = (el.tags?.name || "").toLowerCase();
    if (osmName === nameLower) return 100; // exact
    if (osmName.includes(nameLower) || nameLower.includes(osmName)) return 80;
    // Check word overlap
    const searchWords = nameLower.split(/\s+/);
    const matchCount = searchWords.filter((w) => osmName.includes(w)).length;
    return (matchCount / searchWords.length) * 60;
  };
  const overpassMatch = overpassResults
    .filter(isFoodPlace)
    .map((el) => ({ el, score: scoreMatch(el) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.el)[0] || null;

  // --- Try Nominatim result ---
  const nominatimMatch = nominatimResults[0] || null;

  // --- Merge results ---
  let lat, lon, openingHours, osmType, osmId, displayName, website, phone;

  // If we have a Nominatim result, always try to enrich it with Overpass tags
  // This is the most reliable path: Nominatim for finding + Overpass for tags
  if (nominatimMatch) {
    lat = parseFloat(nominatimMatch.lat);
    lon = parseFloat(nominatimMatch.lon);
    osmType = nominatimMatch.osm_type;
    osmId = nominatimMatch.osm_id;
    displayName = nominatimMatch.name || name;
    console.log(`  Nominatim found: ${nominatimMatch.display_name}`);

    // Enrich with full OSM tags via Overpass ID lookup
    console.log(`  Fetching OSM tags for ${osmType}/${osmId}...`);
    try {
      const element = await fetchOsmElement(osmType, osmId);
      if (element?.tags) {
        openingHours = element.tags.opening_hours;
        website = element.tags.website;
        phone = element.tags.phone;
        displayName = element.tags.name || displayName;
      }
    } catch (e) {
      console.log(`  Could not fetch OSM tags: ${e.message}`);
    }
  }

  // If Nominatim found coords but not hours, try Overpass name match for hours
  if (lat && !openingHours && overpassMatch) {
    const opHours = overpassMatch.tags?.opening_hours;
    if (opHours) {
      console.log(`  Enriching with Overpass hours from: ${overpassMatch.tags?.name}`);
      openingHours = opHours;
      if (!website) website = overpassMatch.tags?.website;
      if (!phone) phone = overpassMatch.tags?.phone;
    }
  }

  // If Nominatim didn't find it, fall back to Overpass name search
  if (!lat && overpassMatch) {
    lat = overpassMatch.lat || overpassMatch.center?.lat;
    lon = overpassMatch.lon || overpassMatch.center?.lon;
    openingHours = overpassMatch.tags?.opening_hours;
    osmType = overpassMatch.type; // "node" or "way"
    osmId = overpassMatch.id;
    displayName = overpassMatch.tags?.name;
    website = overpassMatch.tags?.website;
    phone = overpassMatch.tags?.phone;
    console.log(`  Best match source: Overpass name search`);
  } else if (!lat) {
    console.log("  No results found from any source.");
    return null;
  }

  const result = {
    name: displayName,
    latitude: lat,
    longitude: lon,
    opening_hours: openingHours || null,
    website: website || null,
    phone: phone || null,
    google_maps_url: mapsUrl(lat, lon),
    openstreetmap_url:
      osmType && osmId
        ? osmUrl(osmType, osmId)
        : osmUrlFromCoords(lat, lon),
  };

  // Pretty print
  console.log(`\n  Name:          ${result.name}`);
  console.log(`  Coordinates:   ${result.latitude}, ${result.longitude}`);
  console.log(`  Opening hours: ${result.opening_hours || "Not available"}`);
  console.log(`  Website:       ${result.website || "Not available"}`);
  console.log(`  Phone:         ${result.phone || "Not available"}`);
  console.log(`  Google Maps:   ${result.google_maps_url}`);
  console.log(`  OSM Link:      ${result.openstreetmap_url}`);

  return result;
}

// --- Test with the three restaurants ---
async function main() {
  const restaurants = [
    { name: "Sandholt", address: "Laugavegur 36" },
    { name: "Skál!", address: "Njálsgata 1" },
    { name: "Reykjavik Roasters", address: "Kárastígur 1" },
  ];

  console.log("Restaurant Lookup - Free API Research");
  console.log("APIs: Overpass (OSM data + hours) + Nominatim (geocoding)");
  console.log("No API key required.\n");

  const results = [];

  // Process sequentially to respect rate limits
  for (const r of restaurants) {
    const result = await lookupRestaurant(r.name, r.address);
    results.push(result);
    // Respect rate limits: Nominatim 1 req/sec, Overpass similar
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY (JSON)");
  console.log("=".repeat(60));
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
