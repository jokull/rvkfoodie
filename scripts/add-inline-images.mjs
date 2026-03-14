import fs from "fs";

const PAYLOAD_URL = "https://rvkfoodie-cms.solberg.workers.dev";
const PAYLOAD_TOKEN = fs.readFileSync("/tmp/payload-token.txt", "utf-8").trim();

const posts = [
  {
    slug: "sunday-feast-vinstukan",
    dir: "/tmp/ig-downloads/-DT5Tx8PjBoM",
    prefix: "2026-01-24_13-40-44_UTC",
    count: 6,
    insertAfter: 1, // insert after 1st paragraph
  },
  {
    slug: "farewell-slippurinn",
    dir: "/tmp/ig-downloads/-DQzDv42jPUF",
    prefix: "2025-11-08_13-51-01_UTC",
    count: 6,
    insertAfter: 1,
  },
  {
    slug: "day-trip-naes-westman-islands",
    dir: "/tmp/ig-downloads/-DMhtxwrIiL3",
    prefix: "2025-07-25_10-06-22_UTC",
    count: 6,
    insertAfter: 2,
  },
  {
    slug: "austur-india-turns-30",
    dir: "/tmp/ig-downloads/-DJtg5sQgC_H",
    prefix: "2025-05-16_10-30-00_UTC",
    count: 6,
    insertAfter: 1,
  },
  {
    slug: "coocoos-nest-is-back-harpa",
    dir: "/tmp/ig-downloads/-DAYa1AFgAaP",
    prefix: "2024-09-26_13-10-54_UTC",
    count: 5,
    insertAfter: 1,
  },
  {
    slug: "skal-gets-its-own-space-rvk",
    dir: "/tmp/ig-downloads/-DAIo5CUguug",
    prefix: "2024-09-20_10-05-56_UTC",
    count: 5,
    insertAfter: 1,
  },
];

async function uploadImage(localPath, alt) {
  const blob = new Blob([fs.readFileSync(localPath)], { type: "image/jpeg" });
  const filename = localPath.split("/").pop();

  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("_payload", JSON.stringify({ alt }));

  const res = await fetch(`${PAYLOAD_URL}/api/media`, {
    method: "POST",
    headers: { Authorization: `JWT ${PAYLOAD_TOKEN}` },
    body: formData,
  });
  const data = await res.json();
  if (data.errors) {
    console.error("    Upload error:", data.errors[0]?.message || "unknown");
    return null;
  }
  return data.doc;
}

function makeLexicalUploadNode(mediaDoc) {
  return {
    type: "upload",
    version: 3,
    id: mediaDoc.id.toString(),
    fields: null,
    relationTo: "media",
    value: {
      id: mediaDoc.id,
      alt: mediaDoc.alt,
      filename: mediaDoc.filename,
      url: mediaDoc.url,
      width: mediaDoc.width,
      height: mediaDoc.height,
      mimeType: mediaDoc.mimeType,
    },
    format: "",
    direction: null,
  };
}

async function main() {
  for (const post of posts) {
    console.log(`\n=== ${post.slug} ===`);

    // Get current editorial
    const findRes = await fetch(
      `${PAYLOAD_URL}/api/editorials?where[slug][equals]=${encodeURIComponent(post.slug)}&depth=0`,
      { headers: { Authorization: `JWT ${PAYLOAD_TOKEN}` } },
    );
    const findData = await findRes.json();
    if (!findData.docs?.length) {
      console.log("  Not found, skipping");
      continue;
    }
    const editorial = findData.docs[0];

    // Upload carousel images (start from image 2, since 1 is the hero)
    const uploadNodes = [];
    for (let i = 2; i <= post.count; i++) {
      const path = `${post.dir}/${post.prefix}_${i}.jpg`;
      if (!fs.existsSync(path)) {
        console.log(`  Image ${i} not found: ${path}`);
        continue;
      }
      console.log(`  Uploading image ${i}...`);
      const mediaDoc = await uploadImage(path, `${editorial.title} - photo ${i}`);
      if (mediaDoc) {
        uploadNodes.push(makeLexicalUploadNode(mediaDoc));
      }
    }

    if (uploadNodes.length === 0) {
      console.log("  No images to insert");
      continue;
    }

    // Insert upload nodes into content
    const content = editorial.content;
    const children = [...content.root.children];

    // Insert images after the specified paragraph
    const insertAt = Math.min(post.insertAfter, children.length);
    children.splice(insertAt, 0, ...uploadNodes);

    // Update the editorial
    const updateRes = await fetch(`${PAYLOAD_URL}/api/editorials/${editorial.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `JWT ${PAYLOAD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: { root: { ...content.root, children } },
      }),
    });
    const updateData = await updateRes.json();
    if (updateData.errors) {
      console.error("  Update error:", JSON.stringify(updateData.errors).slice(0, 200));
    } else {
      console.log(`  ✅ Inserted ${uploadNodes.length} inline images`);
    }
  }

  console.log("\n🎉 All inline images added!");
}

main().catch(console.error);
