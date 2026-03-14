import fs from "fs";

const DATO_TOKEN = "168a322ac463ea9cda854e419eb291";
const PAYLOAD_URL = "https://rvkfoodie-cms.solberg.workers.dev";
const PAYLOAD_TOKEN = fs.readFileSync("/tmp/payload-token.txt", "utf-8").trim();

const payloadHeaders = {
  Authorization: `JWT ${PAYLOAD_TOKEN}`,
  "Content-Type": "application/json",
};

async function datoQuery(query, variables = {}) {
  const res = await fetch("https://graphql.datocms.com", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DATO_TOKEN}`,
      "Content-Type": "application/json",
      "X-Include-Drafts": "true",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function uploadMediaToPayload(url, alt) {
  // Download image
  const imgRes = await fetch(url);
  const blob = await imgRes.blob();
  const filename = url.split("/").pop().split("?")[0] || "image.jpg";

  // Upload to Payload
  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("alt", alt || "");

  const res = await fetch(`${PAYLOAD_URL}/api/media`, {
    method: "POST",
    headers: { Authorization: `JWT ${PAYLOAD_TOKEN}` },
    body: formData,
  });
  const data = await res.json();
  if (data.errors) {
    console.error("  Upload failed:", JSON.stringify(data.errors));
    return null;
  }
  return data.doc.id;
}

async function createPayload(collection, body) {
  const res = await fetch(`${PAYLOAD_URL}/api/${collection}`, {
    method: "POST",
    headers: payloadHeaders,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.errors) {
    console.error(`  Create ${collection} failed:`, JSON.stringify(data.errors));
    return null;
  }
  return data.doc;
}

// ============ MIGRATE GUIDES ============

async function migrateGuides() {
  console.log("\n=== MIGRATING GUIDES ===");

  const data = await datoQuery(`{
    allGuides {
      title slug subtitle description price
      gumroadProductId gumroadUrl googleMapsUrl
      content {
        ... on SectionRecord {
          __typename title
          venues {
            ... on VenueRecord {
              name address description note time isFree
            }
          }
        }
        ... on TextBlockRecord {
          __typename heading isFree
          body { value }
        }
      }
    }
  }`);

  for (const guide of data.allGuides) {
    console.log(`\nGuide: ${guide.title}`);

    // Convert DatoCMS blocks to Payload blocks
    const content = guide.content.map((block) => {
      if (block.__typename === "SectionRecord") {
        return {
          blockType: "section",
          title: block.title,
          venues: block.venues.map((v) => ({
            blockType: "venue",
            name: v.name,
            address: v.address || "",
            description: v.description,
            note: v.note || "",
            time: v.time || "",
            isFree: v.isFree,
          })),
        };
      }
      if (block.__typename === "TextBlockRecord") {
        // Convert DatoCMS DAST to Payload Lexical richtext
        const dast = block.body?.value?.document;
        const lexical = dastToLexical(dast);
        return {
          blockType: "textBlock",
          heading: block.heading || "",
          content: lexical,
          isFree: block.isFree,
        };
      }
      return null;
    }).filter(Boolean);

    const doc = await createPayload("guides", {
      title: guide.title,
      slug: guide.slug,
      subtitle: guide.subtitle || "",
      description: guide.description,
      price: guide.price,
      gumroadProductId: guide.gumroadProductId,
      gumroadUrl: guide.gumroadUrl,
      googleMapsUrl: guide.googleMapsUrl || "",
      content,
    });

    if (doc) console.log(`  ✅ Created: ${doc.id}`);
  }
}

// ============ MIGRATE EDITORIALS ============

async function migrateEditorials() {
  console.log("\n=== MIGRATING EDITORIALS ===");

  const data = await datoQuery(`{
    allEditorials(orderBy: date_DESC) {
      title slug excerpt date
      image { url }
      content {
        value
        blocks {
          __typename id
          ... on ImageRecord { image { url alt } }
        }
      }
    }
  }`);

  for (const post of data.allEditorials) {
    console.log(`\nEditorial: ${post.title}`);

    // Upload hero image
    let imageId = null;
    if (post.image?.url) {
      console.log("  Uploading hero image...");
      imageId = await uploadMediaToPayload(post.image.url, post.title);
    }

    // Convert DAST content to Lexical, handling image blocks
    const dast = post.content?.value?.document;
    const blocks = post.content?.blocks || [];
    const lexical = dastToLexical(dast, blocks);

    const doc = await createPayload("editorials", {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      date: post.date,
      image: imageId,
      content: lexical,
    });

    if (doc) console.log(`  ✅ Created: ${doc.id}`);
  }
}

// ============ DAST → LEXICAL CONVERTER ============

function dastToLexical(dast, blocks = []) {
  if (!dast || !dast.children) {
    return { root: { type: "root", children: [], direction: null, format: "", indent: 0, version: 1 } };
  }

  const blockMap = {};
  for (const b of blocks) {
    blockMap[b.id] = b;
  }

  const children = [];

  for (const node of dast.children) {
    const converted = convertDastNode(node, blockMap);
    if (converted) children.push(converted);
  }

  return {
    root: {
      type: "root",
      children,
      direction: null,
      format: "",
      indent: 0,
      version: 1,
    },
  };
}

function convertDastNode(node, blockMap = {}) {
  if (node.type === "paragraph") {
    return {
      type: "paragraph",
      children: (node.children || []).map((c) => convertInlineNode(c)),
      direction: null,
      format: "",
      indent: 0,
      version: 1,
      textFormat: 0,
      textStyle: "",
    };
  }

  if (node.type === "heading") {
    const tag = `h${node.level || 2}`;
    return {
      type: "heading",
      tag,
      children: (node.children || []).map((c) => convertInlineNode(c)),
      direction: null,
      format: "",
      indent: 0,
      version: 1,
    };
  }

  if (node.type === "list") {
    return {
      type: "list",
      listType: node.style === "numbered" ? "number" : "bullet",
      children: (node.children || []).map((item) => ({
        type: "listitem",
        children: (item.children || []).flatMap((c) => {
          if (c.type === "paragraph") return (c.children || []).map(convertInlineNode);
          return [convertInlineNode(c)];
        }),
        direction: null,
        format: "",
        indent: 0,
        version: 1,
        value: 1,
      })),
      direction: null,
      format: "",
      indent: 0,
      start: 1,
      tag: node.style === "numbered" ? "ol" : "ul",
      version: 1,
    };
  }

  if (node.type === "blockquote") {
    return {
      type: "quote",
      children: (node.children || []).flatMap((c) => {
        if (c.type === "paragraph") return [convertDastNode(c, blockMap)];
        return [convertDastNode(c, blockMap)];
      }).filter(Boolean),
      direction: null,
      format: "",
      indent: 0,
      version: 1,
    };
  }

  if (node.type === "block") {
    // DatoCMS block reference — skip for now (images handled separately)
    return null;
  }

  // Fallback: treat as paragraph
  if (node.children) {
    return {
      type: "paragraph",
      children: (node.children || []).map((c) => convertInlineNode(c)),
      direction: null,
      format: "",
      indent: 0,
      version: 1,
      textFormat: 0,
      textStyle: "",
    };
  }

  return null;
}

function convertInlineNode(node) {
  if (node.type === "span") {
    let format = 0;
    if (node.marks) {
      if (node.marks.includes("strong")) format |= 1;
      if (node.marks.includes("emphasis")) format |= 2;
      if (node.marks.includes("underline")) format |= 8;
      if (node.marks.includes("strikethrough")) format |= 4;
      if (node.marks.includes("code")) format |= 16;
    }
    return {
      type: "text",
      text: node.value || "",
      format,
      detail: 0,
      mode: "normal",
      style: "",
      version: 1,
    };
  }

  if (node.type === "link") {
    return {
      type: "link",
      children: (node.children || []).map((c) => convertInlineNode(c)),
      direction: null,
      format: "",
      indent: 0,
      version: 3,
      fields: {
        url: node.url || "",
        newTab: true,
        linkType: "custom",
      },
    };
  }

  // Fallback
  return {
    type: "text",
    text: node.value || "",
    format: 0,
    detail: 0,
    mode: "normal",
    style: "",
    version: 1,
  };
}

// ============ RUN ============

async function main() {
  console.log("Starting migration from DatoCMS → Payload CMS");
  await migrateGuides();
  await migrateEditorials();
  console.log("\n🎉 Migration complete!");
}

main().catch(console.error);
