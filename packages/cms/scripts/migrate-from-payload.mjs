#!/usr/bin/env node

/**
 * Migrates all content from Payload CMS to agent-cms.
 * Handles: assets, editorials, guides (with section/venue blocks),
 * changelog, and globals (home page, about page, site settings).
 */

const PAYLOAD = "https://rvkfoodie-cms.solberg.workers.dev";
const AGENT = "https://rvkfoodie-agent-cms.solberg.workers.dev";

// --- Helpers ---

async function payloadGet(path) {
  const res = await fetch(`${PAYLOAD}${path}`);
  return res.json();
}

async function agentApi(method, path, body) {
  const res = await fetch(`${AGENT}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`  ERROR ${method} ${path}:`, res.status, JSON.stringify(data).slice(0, 300));
    return null;
  }
  return data;
}

// Generate a ULID-like ID
function genId() {
  const t = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const r = Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36).toUpperCase()).join("");
  return `01${t}${r}`.slice(0, 26);
}

// --- Lexical to DAST converter ---

function lexicalToDast(lexicalContent) {
  if (!lexicalContent?.root?.children) return null;

  const blocks = {};

  function convertInlineChildren(children) {
    if (!children) return [{ type: "span", value: "" }];
    return children.map((child) => {
      if (child.type === "text") {
        const marks = [];
        const fmt = child.format || 0;
        if (fmt & 1) marks.push("strong");
        if (fmt & 2) marks.push("emphasis");
        if (fmt & 4) marks.push("strikethrough");
        if (fmt & 8) marks.push("underline");
        if (fmt & 16) marks.push("code");
        return { type: "span", value: child.text || "", ...(marks.length ? { marks } : {}) };
      }
      if (child.type === "link" || child.type === "autolink") {
        const url = child.fields?.url || child.url || "#";
        return {
          type: "link",
          url,
          children: convertInlineChildren(child.children),
        };
      }
      if (child.type === "linebreak") {
        return { type: "span", value: "\n" };
      }
      // Fallback
      return { type: "span", value: child.text || "" };
    });
  }

  function convertNode(node) {
    switch (node.type) {
      case "paragraph":
        return {
          type: "paragraph",
          children: convertInlineChildren(node.children),
        };
      case "heading": {
        const tag = node.tag || "h2";
        const level = parseInt(tag.replace("h", ""), 10) || 2;
        return {
          type: "heading",
          level,
          children: convertInlineChildren(node.children),
        };
      }
      case "list": {
        const style = node.listType === "number" ? "numbered" : "bulleted";
        return {
          type: "list",
          style,
          children: (node.children || []).map((item) => ({
            type: "listItem",
            children: (item.children || []).map((c) => {
              if (c.type === "list") return convertNode(c);
              return { type: "paragraph", children: convertInlineChildren(c.children || [c]) };
            }),
          })),
        };
      }
      case "quote":
        return {
          type: "blockquote",
          children: (node.children || []).map(convertNode).filter(Boolean),
        };
      case "upload": {
        // Payload upload node — convert to inline reference or skip
        // We can't embed uploads in DAST directly; they become block references
        // For now, skip upload nodes (images handled separately)
        return null;
      }
      default:
        if (node.children) {
          return { type: "paragraph", children: convertInlineChildren(node.children) };
        }
        return null;
    }
  }

  const dastChildren = lexicalContent.root.children
    .map(convertNode)
    .filter(Boolean);

  if (dastChildren.length === 0) return null;

  return {
    value: {
      schema: "dast",
      document: { type: "root", children: dastChildren },
    },
    blocks,
  };
}

// --- Asset migration ---

async function migrateAssets() {
  console.log("\n=== Migrating Assets ===");
  const data = await payloadGet("/api/media?limit=100&depth=0");
  const assets = data.docs;
  console.log(`Found ${assets.length} assets in Payload`);

  const assetMap = {}; // payload id → agent-cms asset id

  for (const asset of assets) {
    // Register the asset in agent-cms (file already in R2 bucket)
    const result = await agentApi("POST", "/api/assets", {
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.filesize,
      width: asset.width || null,
      height: asset.height || null,
      alt: asset.alt || "",
      r2Key: asset.filename, // Same R2 key since we share the bucket
    });
    if (result) {
      assetMap[asset.id] = result.id;
      console.log(`  ✓ ${asset.filename} → ${result.id}`);
    }
  }

  return assetMap;
}

// --- Editorial migration ---

async function migrateEditorials(assetMap) {
  console.log("\n=== Migrating Editorials ===");
  const data = await payloadGet("/api/editorials?limit=50&depth=1&sort=-date");
  const editorials = data.docs;

  for (const ed of editorials) {
    const dast = lexicalToDast(ed.content);
    const imageId = ed.image ? assetMap[ed.image.id] : null;

    const record = await agentApi("POST", "/api/records", {
      modelApiKey: "editorial",
      data: {
        title: ed.title,
        slug: ed.slug,
        excerpt: ed.excerpt || "",
        date: ed.date,
        image: imageId || null,
        content: dast,
      },
    });
    if (record) {
      console.log(`  ✓ ${ed.title} → ${record.id}`);
      // Auto-publish
      await agentApi("POST", `/api/records/${record.id}/publish`, { modelApiKey: "editorial" });
    }
  }
}

// --- Guide migration (complex: nested section/venue blocks) ---

async function migrateGuides(assetMap) {
  console.log("\n=== Migrating Guides ===");
  const data = await payloadGet("/api/guides?limit=10&depth=2");
  const guides = data.docs;

  for (const guide of guides) {
    // Convert intro
    const introDast = guide.intro ? lexicalToDast(guide.intro) : null;

    // Convert content blocks (sections and text blocks) to DAST with embedded blocks
    const contentBlocks = {};
    const contentChildren = [];

    for (const block of guide.content || []) {
      if (block.blockType === "section") {
        const sectionId = genId();

        // Convert venues within section to nested DAST blocks
        const venueBlocks = {};
        const venueChildren = [];

        for (const venue of block.venues || []) {
          const venueId = genId();
          venueBlocks[venueId] = {
            _type: "venue",
            name: venue.name,
            address: venue.address || "",
            description: venue.description,
            note: venue.note || null,
            time: venue.time || null,
            is_free: venue.isFree || false,
            location: venue.latitude && venue.longitude
              ? { latitude: venue.latitude, longitude: venue.longitude }
              : null,
            opening_hours: venue.openingHours || null,
            google_maps_url: venue.googleMapsUrl || null,
            website: venue.website || null,
            phone: venue.phone || null,
            best_of_award: venue.bestOfAward || null,
            grapevine_url: venue.grapevineUrl || null,
            image: venue.image ? assetMap[venue.image.id || venue.image] : null,
          };
          venueChildren.push({ type: "block", item: venueId });
        }

        contentBlocks[sectionId] = {
          _type: "section",
          title: block.title,
          venues: {
            value: { schema: "dast", document: { type: "root", children: venueChildren } },
            blocks: venueBlocks,
          },
        };
        contentChildren.push({ type: "block", item: sectionId });
      } else if (block.blockType === "textBlock") {
        const tbId = genId();
        const tbDast = block.content ? lexicalToDast(block.content) : null;
        contentBlocks[tbId] = {
          _type: "text_block",
          heading: block.heading || null,
          content: tbDast,
          is_free: block.isFree || false,
        };
        contentChildren.push({ type: "block", item: tbId });
      }
    }

    const contentDast = contentChildren.length > 0
      ? {
          value: { schema: "dast", document: { type: "root", children: contentChildren } },
          blocks: contentBlocks,
        }
      : null;

    const record = await agentApi("POST", "/api/records", {
      modelApiKey: "guide",
      data: {
        title: guide.title,
        slug: guide.slug,
        subtitle: guide.subtitle || "",
        description: guide.description,
        price: guide.price,
        gumroad_product_id: guide.gumroadProductId,
        gumroad_url: guide.gumroadUrl,
        google_maps_url: guide.googleMapsUrl || null,
        intro: introDast,
        content: contentDast,
      },
    });
    if (record) {
      console.log(`  ✓ ${guide.title} → ${record.id}`);
      await agentApi("POST", `/api/records/${record.id}/publish`, { modelApiKey: "guide" });
    }
  }
}

// --- Changelog migration ---

async function migrateChangelog() {
  console.log("\n=== Migrating Changelog ===");
  const data = await payloadGet("/api/changelog?limit=100&depth=1&sort=-date");
  const entries = data.docs;

  // First pass: get all guide records from agent-cms to map slugs → IDs
  const agentGuides = await agentApi("GET", "/api/records?modelApiKey=guide");
  const guideMap = {};
  for (const g of agentGuides || []) {
    guideMap[g.slug] = g._id;
  }

  for (const entry of entries) {
    const guideRef = entry.guide?.slug ? guideMap[entry.guide.slug] : null;

    const record = await agentApi("POST", "/api/records", {
      modelApiKey: "changelog_entry",
      data: {
        date: entry.date,
        title: entry.title,
        description: entry.description || null,
        change_type: entry.changeType,
        guide: guideRef || null,
      },
    });
    if (record) {
      console.log(`  ✓ ${entry.title} → ${record.id}`);
      await agentApi("POST", `/api/records/${record.id}/publish`, { modelApiKey: "changelog_entry" });
    }
  }
}

// --- Globals migration ---

async function migrateGlobals() {
  console.log("\n=== Migrating Globals ===");

  // Home Page
  const home = await payloadGet("/api/globals/homePage");
  await agentApi("POST", "/api/records", {
    modelApiKey: "home_page",
    data: {
      headline: home.headline,
      headline_emphasis: home.headlineEmphasis || null,
      subtext: home.subtext,
      bundle_title: home.bundleTitle,
      bundle_description: home.bundleDescription,
      bundle_price: home.bundlePrice,
      bundle_gumroad_url: home.bundleGumroadUrl,
      author_blurb: home.authorBlurb,
    },
  });
  console.log("  ✓ Home Page");

  // About Page
  const about = await payloadGet("/api/globals/aboutPage");
  const bioDast = about.bio ? lexicalToDast(about.bio) : null;
  await agentApi("POST", "/api/records", {
    modelApiKey: "about_page",
    data: {
      title: about.title,
      meta_description: about.metaDescription,
      bio: bioDast,
    },
  });
  console.log("  ✓ About Page");

  // Site Settings
  const settings = await payloadGet("/api/globals/siteSettings");
  await agentApi("POST", "/api/records", {
    modelApiKey: "site_settings",
    data: {
      default_meta_description: settings.defaultMetaDescription,
      restaurant_callout_title: settings.restaurantCalloutTitle,
      restaurant_callout_text: settings.restaurantCalloutText,
      restaurant_callout_email: settings.restaurantCalloutEmail,
      changelog_subtitle: settings.changelogSubtitle,
    },
  });
  console.log("  ✓ Site Settings");
}

// --- Main ---

async function main() {
  console.log("=== Migrating from Payload CMS to agent-cms ===");
  console.log(`Source: ${PAYLOAD}`);
  console.log(`Target: ${AGENT}`);

  const assetMap = await migrateAssets();
  await migrateEditorials(assetMap);
  await migrateGuides(assetMap);
  await migrateChangelog();
  await migrateGlobals();

  console.log("\n=== Migration complete ===");
}

main().catch(console.error);
