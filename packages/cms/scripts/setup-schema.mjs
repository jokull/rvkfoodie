#!/usr/bin/env node

/**
 * Sets up the rvkfoodie schema in agent-cms.
 * Creates models, block types, fields, and singletons.
 */

const CMS = "https://rvkfoodie-agent-cms.solberg.workers.dev";

async function api(method, path, body) {
  const res = await fetch(`${CMS}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`  ERROR ${method} ${path}:`, res.status, JSON.stringify(data).slice(0, 200));
    return null;
  }
  return data;
}

async function createModel(name, apiKey, opts = {}) {
  console.log(`\nCreating model: ${name} (${apiKey})`);
  const result = await api("POST", "/api/models", { name, apiKey, ...opts });
  if (result) console.log(`  ✓ id: ${result.id}`);
  return result;
}

async function createField(modelId, label, apiKey, fieldType, opts = {}) {
  const result = await api("POST", `/api/models/${modelId}/fields`, { label, apiKey, fieldType, ...opts });
  if (result) console.log(`  + ${apiKey} (${fieldType})`);
  return result;
}

async function main() {
  console.log("=== Setting up rvkfoodie schema ===\n");

  // ---- Block types ----

  const venue = await createModel("Venue", "venue", { isBlock: true });
  if (venue) {
    await createField(venue.id, "Name", "name", "string", { validators: { required: true } });
    await createField(venue.id, "Address", "address", "string");
    await createField(venue.id, "Description", "description", "text", { validators: { required: true } });
    await createField(venue.id, "Note", "note", "string");
    await createField(venue.id, "Time", "time", "string");
    await createField(venue.id, "Is Free", "is_free", "boolean");
    await createField(venue.id, "Location", "location", "lat_lon");
    await createField(venue.id, "Opening Hours", "opening_hours", "string");
    await createField(venue.id, "Google Maps URL", "google_maps_url", "string");
    await createField(venue.id, "Website", "website", "string");
    await createField(venue.id, "Phone", "phone", "string");
    await createField(venue.id, "Best Of Award", "best_of_award", "string");
    await createField(venue.id, "Grapevine URL", "grapevine_url", "string");
    await createField(venue.id, "Image", "image", "media");
  }

  const section = await createModel("Section", "section", { isBlock: true });
  if (section) {
    await createField(section.id, "Title", "title", "string", { validators: { required: true } });
    // Sections contain venues via structured text
    await createField(section.id, "Venues", "venues", "structured_text", {
      validators: { structured_text_blocks: ["venue"] },
    });
  }

  const textBlock = await createModel("Text Block", "text_block", { isBlock: true });
  if (textBlock) {
    await createField(textBlock.id, "Heading", "heading", "string");
    await createField(textBlock.id, "Content", "content", "structured_text");
    await createField(textBlock.id, "Is Free", "is_free", "boolean");
  }

  // ---- Collections ----

  const guide = await createModel("Guide", "guide");
  if (guide) {
    await createField(guide.id, "Title", "title", "string", { validators: { required: true } });
    await createField(guide.id, "Slug", "slug", "slug", { validators: { required: true, slug_source: "title" } });
    await createField(guide.id, "Subtitle", "subtitle", "string");
    await createField(guide.id, "Description", "description", "text", { validators: { required: true } });
    await createField(guide.id, "Price", "price", "integer", { validators: { required: true } });
    await createField(guide.id, "Gumroad Product ID", "gumroad_product_id", "string", { validators: { required: true } });
    await createField(guide.id, "Gumroad URL", "gumroad_url", "string", { validators: { required: true } });
    await createField(guide.id, "Google Maps URL", "google_maps_url", "string");
    await createField(guide.id, "Intro", "intro", "structured_text");
    await createField(guide.id, "Content", "content", "structured_text", {
      validators: { structured_text_blocks: ["section", "text_block"] },
    });
  }

  const editorial = await createModel("Editorial", "editorial");
  if (editorial) {
    await createField(editorial.id, "Title", "title", "string", { validators: { required: true } });
    await createField(editorial.id, "Slug", "slug", "slug", { validators: { required: true, slug_source: "title" } });
    await createField(editorial.id, "Excerpt", "excerpt", "text");
    await createField(editorial.id, "Date", "date", "date", { validators: { required: true } });
    await createField(editorial.id, "Image", "image", "media");
    await createField(editorial.id, "Content", "content", "structured_text");
  }

  const changelog = await createModel("Changelog Entry", "changelog_entry", { sortable: true });
  if (changelog) {
    await createField(changelog.id, "Date", "date", "date", { validators: { required: true } });
    await createField(changelog.id, "Title", "title", "string", { validators: { required: true } });
    await createField(changelog.id, "Description", "description", "text");
    await createField(changelog.id, "Change Type", "change_type", "string", { validators: { required: true } });
    await createField(changelog.id, "Guide", "guide", "link", { validators: { item_item_type: ["guide"] } });
  }

  // ---- Singletons (Globals) ----

  const homePage = await createModel("Home Page", "home_page", { singleton: true, hasDraft: false });
  if (homePage) {
    await createField(homePage.id, "Headline", "headline", "string", { validators: { required: true } });
    await createField(homePage.id, "Headline Emphasis", "headline_emphasis", "string");
    await createField(homePage.id, "Subtext", "subtext", "text", { validators: { required: true } });
    await createField(homePage.id, "Bundle Title", "bundle_title", "string");
    await createField(homePage.id, "Bundle Description", "bundle_description", "string");
    await createField(homePage.id, "Bundle Price", "bundle_price", "integer");
    await createField(homePage.id, "Bundle Gumroad URL", "bundle_gumroad_url", "string");
    await createField(homePage.id, "Author Blurb", "author_blurb", "string");
  }

  const aboutPage = await createModel("About Page", "about_page", { singleton: true, hasDraft: false });
  if (aboutPage) {
    await createField(aboutPage.id, "Title", "title", "string", { validators: { required: true } });
    await createField(aboutPage.id, "Meta Description", "meta_description", "string");
    await createField(aboutPage.id, "Bio", "bio", "structured_text");
  }

  const siteSettings = await createModel("Site Settings", "site_settings", { singleton: true, hasDraft: false });
  if (siteSettings) {
    await createField(siteSettings.id, "Default Meta Description", "default_meta_description", "text");
    await createField(siteSettings.id, "Restaurant Callout Title", "restaurant_callout_title", "string");
    await createField(siteSettings.id, "Restaurant Callout Text", "restaurant_callout_text", "string");
    await createField(siteSettings.id, "Restaurant Callout Email", "restaurant_callout_email", "string");
    await createField(siteSettings.id, "Changelog Subtitle", "changelog_subtitle", "string");
  }

  console.log("\n=== Schema setup complete ===");

  // Verify
  const models = await api("GET", "/api/models");
  console.log("\nModels created:", models?.length);
  models?.forEach((m) => console.log(`  ${m.name} (${m.apiKey}) ${m.isBlock ? "[block]" : ""} ${m.singleton ? "[singleton]" : ""}`));
}

main().catch(console.error);
