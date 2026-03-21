/**
 * Migrate rvkfoodie CMS from ULID IDs to nanoid IDs.
 *
 * Strategy: export all content via REST API, wipe D1 via wrangler,
 * re-import schema, re-create assets and records with new nanoid IDs.
 *
 * Usage: node scripts/migrate-to-nanoid.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const CMS_URL = "https://www.rvkfoodie.is/cms";
const D1_DB = "rvkfoodie-cms-v4b";
const CMS_KEY = readFileSync(".dev.vars", "utf8")
  .split("\n")
  .find((l) => l.startsWith("CMS_WRITE_KEY"))
  ?.split("=")[1]
  ?.trim();

if (!CMS_KEY) throw new Error("CMS_WRITE_KEY not found in .dev.vars");

const headers = {
  Authorization: `Bearer ${CMS_KEY}`,
  "Content-Type": "application/json",
};

async function api(method, path, body) {
  const res = await fetch(`${CMS_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

function d1(sql) {
  execSync(
    `wrangler d1 execute ${D1_DB} --remote --command "${sql.replace(/"/g, '\\"')}"`,
    { stdio: "pipe" }
  );
}

// ---------------------------------------------------------------------------
// Phase 1: Export everything
// ---------------------------------------------------------------------------

console.log("=== Phase 1: Export ===");

const models = await api("GET", "/api/models");
console.log(`Models: ${models.length}`);

const assets = await api("GET", "/api/assets");
console.log(`Assets: ${assets.length}`);

const contentModels = models.filter((m) => !m.is_block);
const allRecords = {};
for (const model of contentModels) {
  const records = await api("GET", `/api/records?modelApiKey=${model.api_key}`);
  allRecords[model.api_key] = records;
  console.log(`  ${model.api_key}: ${records.length} records`);
}

// Export fields per model
const fieldsById = {};
for (const model of models) {
  fieldsById[model.id] = await api("GET", `/api/models/${model.id}/fields`);
}

// Build portable schema
const schemaExport = {
  version: 1,
  locales: [],
  models: models.map((m) => ({
    name: m.name,
    apiKey: m.api_key,
    isBlock: !!m.is_block,
    singleton: !!m.singleton,
    sortable: !!m.sortable,
    tree: !!m.tree,
    hasDraft: !!m.has_draft,
    ordering: m.ordering,
    fields: (fieldsById[m.id] || []).map((f) => ({
      label: f.label,
      apiKey: f.api_key,
      fieldType: f.field_type,
      position: f.position,
      localized: !!f.localized,
      validators: typeof f.validators === "string" ? JSON.parse(f.validators) : (f.validators || {}),
      hint: f.hint,
    })),
  })),
};

// Save exports for safety
writeFileSync("backups/pre-nanoid/schema_export.json", JSON.stringify(schemaExport, null, 2));
writeFileSync("backups/pre-nanoid/all_records.json", JSON.stringify(allRecords, null, 2));
writeFileSync("backups/pre-nanoid/all_assets.json", JSON.stringify(assets, null, 2));
console.log("  Saved exports to backups/pre-nanoid/");

// ---------------------------------------------------------------------------
// Phase 2: Wipe D1 via wrangler
// ---------------------------------------------------------------------------

console.log("\n=== Phase 2: Wipe D1 ===");

// Drop dynamic tables
const dynamicTables = models.map((m) =>
  m.is_block ? `block_${m.api_key}` : `content_${m.api_key}`
);
for (const table of dynamicTables) {
  try { d1(`DROP TABLE IF EXISTS '${table}'`); } catch { /* ignore */ }
}
// Drop FTS tables
for (const m of contentModels) {
  try { d1(`DROP TABLE IF EXISTS 'fts_${m.api_key}'`); } catch { /* ignore */ }
}

// Clear system tables (order matters for FK-like dependencies)
for (const table of ["record_versions", "editor_tokens", "assets", "fields", "fieldsets", "models", "locales"]) {
  try { d1(`DELETE FROM '${table}'`); } catch { /* ignore */ }
}
console.log("  D1 wiped");

// ---------------------------------------------------------------------------
// Phase 3: Re-import schema (must hit the deployed worker with new agent-cms)
// ---------------------------------------------------------------------------

console.log("\n=== Phase 3: Import schema ===");

// The worker needs to be redeployed first with new agent-cms (nanoid support)
// Calling the import endpoint will create models/fields with new nanoid IDs
const importResult = await api("POST", "/api/schema", schemaExport);
console.log(`  Imported: ${JSON.stringify(importResult)}`);

// ---------------------------------------------------------------------------
// Phase 4: Re-create assets
// ---------------------------------------------------------------------------

console.log("\n=== Phase 4: Re-create assets ===");

const oldToNewAssetId = new Map();

for (const asset of assets) {
  const created = await api("POST", "/api/assets", {
    filename: asset.filename,
    mime_type: asset.mime_type,
    size: asset.size,
    width: asset.width,
    height: asset.height,
    r2_key: asset.r2_key,
    alt: asset.alt,
    title: asset.title,
  });
  oldToNewAssetId.set(asset.id, created.id);
}
console.log(`  ${oldToNewAssetId.size} assets remapped`);

// ---------------------------------------------------------------------------
// Phase 5: Re-create records
// ---------------------------------------------------------------------------

console.log("\n=== Phase 5: Re-create records ===");

function remapBlockAssetIds(blocks) {
  if (!blocks || typeof blocks !== "object") return blocks;
  const remapped = {};
  for (const [blockId, block] of Object.entries(blocks)) {
    const newBlock = { ...block };
    const blockDef = schemaExport.models.find((m) => m.apiKey === block._type);
    if (blockDef) {
      for (const f of blockDef.fields) {
        if (f.fieldType === "media" && typeof newBlock[f.apiKey] === "string") {
          if (oldToNewAssetId.has(newBlock[f.apiKey])) {
            newBlock[f.apiKey] = oldToNewAssetId.get(newBlock[f.apiKey]);
          }
        }
        if (f.fieldType === "structured_text" && newBlock[f.apiKey]?.blocks) {
          newBlock[f.apiKey] = {
            ...newBlock[f.apiKey],
            blocks: remapBlockAssetIds(newBlock[f.apiKey].blocks),
          };
        }
      }
    }
    remapped[blockId] = newBlock;
  }
  return remapped;
}

const oldToNewRecordId = new Map();
const createOrder = [
  "site_settings", "home_page", "about_page",
  "guide", "editorial", "changelog_entry",
];

for (const modelKey of createOrder) {
  const records = allRecords[modelKey] || [];
  const modelDef = schemaExport.models.find((m) => m.apiKey === modelKey);
  if (!modelDef) continue;

  for (const record of records) {
    const data = {};
    for (const field of modelDef.fields) {
      let value = record[field.apiKey];
      if (value === undefined) continue;

      // Remap link fields
      if (field.fieldType === "link" && typeof value === "string" && oldToNewRecordId.has(value)) {
        value = oldToNewRecordId.get(value);
      }
      if (field.fieldType === "links" && Array.isArray(value)) {
        value = value.map((id) => oldToNewRecordId.has(id) ? oldToNewRecordId.get(id) : id);
      }
      // Remap media fields
      if (field.fieldType === "media" && typeof value === "string" && oldToNewAssetId.has(value)) {
        value = oldToNewAssetId.get(value);
      }
      // Remap asset IDs in structured text blocks
      if (field.fieldType === "structured_text" && value?.blocks) {
        value = { ...value, blocks: remapBlockAssetIds(value.blocks) };
      }

      data[field.apiKey] = value;
    }

    try {
      const created = await api("POST", "/api/records", { modelApiKey: modelKey, data });
      oldToNewRecordId.set(record.id, created.id);
      const label = record.title || record.slug || record.headline || record.id;
      process.stdout.write(`  ${modelKey}: ${label} (${record.id.slice(0,8)}… → ${created.id})`);

      if (modelDef.hasDraft && (record._status === "published" || record._status === "updated")) {
        await api("PUT", `/api/records/${created.id}/publish`, {});
        process.stdout.write(" ✓\n");
      } else {
        process.stdout.write("\n");
      }
    } catch (err) {
      console.error(`  FAILED ${modelKey} ${record.id}: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 6: Reindex search
// ---------------------------------------------------------------------------

console.log("\n=== Phase 6: Reindex ===");
try {
  await api("POST", "/api/search/reindex", {});
  console.log("  Search reindexed");
} catch (err) {
  console.log(`  Reindex: ${err.message}`);
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

writeFileSync(
  "backups/pre-nanoid/id_mappings.json",
  JSON.stringify({
    assets: Object.fromEntries(oldToNewAssetId),
    records: Object.fromEntries(oldToNewRecordId),
  }, null, 2)
);

console.log(`\n=== Done ===`);
console.log(`Assets: ${oldToNewAssetId.size} remapped`);
console.log(`Records: ${oldToNewRecordId.size} remapped`);
console.log(`Mappings: backups/pre-nanoid/id_mappings.json`);
