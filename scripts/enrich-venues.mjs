#!/usr/bin/env node

/**
 * Enriches venue blocks in Payload CMS with coordinates, opening hours,
 * Google Maps links, phone, website, and Grapevine Best Of awards.
 *
 * Usage: node scripts/enrich-venues.mjs
 */

const PAYLOAD_URL = "https://rvkfoodie-cms.solberg.workers.dev";
const EMAIL = "jokull@solberg.is";
const PASSWORD = "dansar-8nimQe-tamfam";

// Venue enrichment data keyed by venue name (lowercase for matching)
const VENUE_DATA = {
  "sandholt bakery": { lat: 64.1450, lon: -21.9260, hours: "Mo-Su 07:30-18:00", gmaps: "https://www.google.com/maps/search/Sandholt+Laugavegur+36+Reykjavik", bestOf: "Best Bakery 2025 — Reykjavík Grapevine", grapevineUrl: "https://grapevine.is/best-of-reykjavik/2025/02/23/best-of-reykjavik-2025-best-bakery/" },
  "deig workshop": { lat: 64.1501, lon: -21.9434, hours: "Mo-Fr 07:00-17:00; Sa-Su 08:00-16:00", gmaps: "https://www.google.com/maps/search/DEIG+Workshop+Tryggvagata+Reykjavik", address: "Tryggvagata 14" },
  "reykjavik roasters": { lat: 64.1440, lon: -21.9270, hours: "Mo-Fr 08:30-17:00; Sa 09:00-17:00; Su 10:00-17:00", gmaps: "https://www.google.com/maps/search/Reykjavik+Roasters+Reykjavik", bestOf: "Best Coffeehouse 2025 — Reykjavík Grapevine", grapevineUrl: "https://grapevine.is/best-of-reykjavik/2025/02/23/best-of-reykjavik-2025-best-coffeehouse/" },
  "brauð & co": { lat: 64.1440, lon: -21.9261, gmaps: "https://www.google.com/maps/search/Brauð+Co+Frakkastígur+Reykjavik" },
  "plantan": { lat: 64.1425, lon: -21.9205, gmaps: "https://www.google.com/maps/search/Plantan+Njálsgata+Reykjavik" },
  "jómfrúin": { lat: 64.1468, lon: -21.9374, hours: "Mo-Su 11:30-22:00", phone: "551 0100", gmaps: "https://www.google.com/maps/search/Jómfrúin+Lækjargata+Reykjavik" },
  "apótek": { lat: 64.1474, lon: -21.9385, gmaps: "https://www.google.com/maps/search/Apótek+Austurstræti+Reykjavik" },
  "bæjarins beztu pylsur": { lat: 64.1481, lon: -21.9393, hours: "~10 AM-01 AM daily", gmaps: "https://www.google.com/maps/search/Bæjarins+Beztu+Pylsur+Reykjavik" },
  "fine": { lat: 64.1407, lon: -21.9147, hours: "Mo-Th 13:30-22:00; Fr-Sa 13:30-23:00; Su 13:30-22:00", gmaps: "https://www.google.com/maps/search/Fine+Rauðarárstígur+Reykjavik" },
  "chickpea": { lat: 64.1457, lon: -21.9341, hours: "Mo-Su 10:00-20:00", website: "chickpea.is", gmaps: "https://www.google.com/maps/search/Chickpea+Reykjavik" },
  "shalimar": { lat: 64.1479, lon: -21.9407, hours: "Mo-Th 11:30-22:00; Fr 11:30-23:00; Sa 16:00-23:00; Su 16:00-22:00", phone: "551 0292", website: "shalimar.is", gmaps: "https://www.google.com/maps/search/Shalimar+Reykjavik" },
  "ramen momo": { lat: 64.1499, lon: -21.9431, hours: "Mo-Fr 11:30-21:00; Sa-Su 12:00-21:30", website: "ramenmomo.is", gmaps: "https://www.google.com/maps/search/Ramen+Momo+Reykjavik" },
  "austur indíafélagið": { lat: 64.1457, lon: -21.9256, hours: "Su-Th 18:00-22:00; Fr-Sa 18:00-23:00", website: "austurindia.is", gmaps: "https://www.google.com/maps/search/Austur+Indíafélagið+Reykjavik", bestOf: "Best Goddamn Restaurant 2025 — Reykjavík Grapevine", grapevineUrl: "https://grapevine.is/best-of-reykjavik/2025/10/27/best-of-reykjavik-2025-best-goddamn-restaurant/" },
  "skál!": { lat: 64.1447, lon: -21.9298, hours: "Mo-Tu 17:00-23:00; We-Th closed; Fr-Sa 12:00-15:00, 17:00-00:00; Su 12:00-15:00, 17:00-23:00", phone: "565 6515", gmaps: "https://www.google.com/maps/search/Skál+restaurant+Njálsgata+Reykjavik" },
  "la primavera": { lat: 64.1561, lon: -21.9389, hours: "Tu-Fr 11:30-14:00; Th-Sa 18:00-21:30; Su-Mo closed", phone: "519 7766", website: "laprimavera.is", gmaps: "https://www.google.com/maps/search/La+Primavera+Grandagarður+Reykjavik", address: "Marshallhúsið, Grandagarður 20" },
  "2guys at hlemmur": { lat: 64.1432, lon: -21.9160, hours: "Mo-Su 11:30-21:00", phone: "790 2323", website: "2guys.is", gmaps: "https://maps.app.goo.gl/R8dkUo5DwJG1jyUs7" },
  "le kock": { lat: 64.1501, lon: -21.9434, hours: "Mo-Su 11:30-22:00", website: "lekock.is", gmaps: "https://www.google.com/maps/search/Le+Kock+Tryggvagata+Reykjavik" },
  "sumac grill + drinks": { lat: 64.1454, lon: -21.9277, hours: "Tu-Th 17:30-22:00; Fr-Sa 17:30-24:00", website: "sumac.is", gmaps: "https://www.google.com/maps/search/Sumac+Grill+Laugavegur+Reykjavik" },
  "ban thai": { lat: 64.1429, lon: -21.9120, hours: "Su-Th 18:00-22:00; Fr-Sa 18:00-23:30", phone: "552 2444", website: "banthai.is", gmaps: "https://www.google.com/maps/search/Ban+Thai+Laugavegur+130+Reykjavik" },
  "skreið": { lat: 64.1463, lon: -21.9326, hours: "Mo 17-23; Tu 17-23; We 15-23; Th 15-00; Fr 15-00; Sa 15-00; Su 15-23", phone: "784 0404", website: "skreid.is", gmaps: "https://maps.app.goo.gl/te9QQGqXp7RMUN9M8", address: "Laugavegur 4" },
  "vínstúkan tíu sopar": { lat: 64.1456, lon: -21.9284, hours: "Mo-Th 17:00-00:00; Fr-Sa 15:00-01:00; Su 17:00-00:00", phone: "547 2380", website: "tiu-sopar.is", gmaps: "https://www.google.com/maps/search/Vínstúkan+Tíu+Sopar+Reykjavik", bestOf: "Best Wine Bar 2025 + 2026 — Reykjavík Grapevine", grapevineUrl: "https://grapevine.is/best-of-reykjavik/2026/02/24/best-of-reykjavik-2026-best-wine-bar-2/" },
  "röntgen": { lat: 64.1471, lon: -21.9330, hours: "Mo 18-00; Tu-We 16-01; Th 14-01; Fr-Sa 14-03; Su 18-00", phone: "691 9662", website: "rontgenbar.is", gmaps: "https://www.google.com/maps/search/Röntgen+bar+Hverfisgata+Reykjavik", bestOf: "Best Goddamn Bar 2026 — Reykjavík Grapevine", grapevineUrl: "https://grapevine.is/best-of-reykjavik/2026/02/24/best-of-reykjavik-2026-best-goddamn-bar/" },
  "kramber": { lat: 64.1454, lon: -21.9323, hours: "Tu-Sa 15:00-23:00; Su 15:00-21:00; Mo closed", phone: "869 7020", gmaps: "https://www.google.com/maps/search/Kramber+bar+Reykjavik", address: "Bergstaðastræti 101" },
  "port 9": { lat: 64.1464, lon: -21.9265, hours: "Mo-Su 17:00-00:00", phone: "832 2929", website: "port9.is", gmaps: "https://www.google.com/maps/search/Port+9+bar+Reykjavik" },
  "amma don": { lat: 64.1446, lon: -21.9233, hours: "Tu-Fr 18:00-00:00; Sa 12:30-16:30, 18:00-00:00; Su-Mo closed", phone: "779 0399", gmaps: "https://maps.app.goo.gl/Ui1cb3jAhv7PgZFT6", address: "Laugavegur 55 (Hotel VON)" },
};

async function login() {
  const res = await fetch(`${PAYLOAD_URL}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json();
  return data.token;
}

async function getGuides(token) {
  const res = await fetch(`${PAYLOAD_URL}/api/guides?limit=10&depth=2`, {
    headers: { Authorization: `JWT ${token}` },
  });
  const data = await res.json();
  return data.docs;
}

async function updateGuide(token, id, content) {
  const res = await fetch(`${PAYLOAD_URL}/api/guides/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
    body: JSON.stringify({ content }),
  });
  return res.status;
}

function findVenueData(venueName) {
  const key = venueName.toLowerCase();
  // Try exact match first
  if (VENUE_DATA[key]) return VENUE_DATA[key];
  // Try partial match
  for (const [k, v] of Object.entries(VENUE_DATA)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

async function main() {
  console.log("Logging in...");
  const token = await login();
  if (!token) { console.error("Login failed"); process.exit(1); }

  console.log("Fetching guides...");
  const guides = await getGuides(token);

  let updated = 0;
  let skipped = 0;

  for (const guide of guides) {
    console.log(`\nProcessing: ${guide.title}`);
    let changed = false;

    for (const block of guide.content) {
      if (block.blockType !== "section") continue;
      for (const venue of block.venues) {
        const data = findVenueData(venue.name);
        if (!data) {
          console.log(`  ⚠ No data for: ${venue.name}`);
          skipped++;
          continue;
        }

        // Update fields
        if (data.lat) { venue.latitude = data.lat; changed = true; }
        if (data.lon) { venue.longitude = data.lon; changed = true; }
        if (data.hours) { venue.openingHours = data.hours; changed = true; }
        if (data.gmaps) { venue.googleMapsUrl = data.gmaps; changed = true; }
        if (data.website) { venue.website = data.website; changed = true; }
        if (data.phone) { venue.phone = data.phone; changed = true; }
        if (data.bestOf) { venue.bestOfAward = data.bestOf; changed = true; }
        if (data.grapevineUrl) { venue.grapevineUrl = data.grapevineUrl; changed = true; }
        if (data.address) { venue.address = data.address; changed = true; }

        console.log(`  ✓ ${venue.name} — ${data.lat},${data.lon} ${data.hours ? "✓hours" : ""} ${data.bestOf ? "🏆" : ""}`);
        updated++;
      }
    }

    if (changed) {
      const status = await updateGuide(token, guide.id, guide.content);
      console.log(`  → Saved guide ${guide.title}: HTTP ${status}`);
    }
  }

  console.log(`\nDone: ${updated} venues enriched, ${skipped} skipped`);
}

main().catch(console.error);
