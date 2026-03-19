import fs from "fs";

const DATO_TOKEN = "168a322ac463ea9cda854e419eb291";
const PAYLOAD_URL = "https://rvkfoodie-cms.solberg.workers.dev";
const PAYLOAD_TOKEN = fs.readFileSync("/tmp/payload-token.txt", "utf-8").trim();

async function datoQuery(query) {
  const res = await fetch("https://graphql.datocms.com", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DATO_TOKEN}`,
      "Content-Type": "application/json",
      "X-Include-Drafts": "true",
    },
    body: JSON.stringify({ query }),
  });
  return (await res.json()).data;
}

async function uploadToPayload(url, altText) {
  const imgRes = await fetch(url);
  const blob = await imgRes.blob();
  const filename = url.split("/").pop().split("?")[0] || "image.jpg";

  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("_payload", JSON.stringify({ alt: altText }));

  const res = await fetch(`${PAYLOAD_URL}/api/media`, {
    method: "POST",
    headers: { Authorization: `JWT ${PAYLOAD_TOKEN}` },
    body: formData,
  });
  const data = await res.json();
  if (data.errors) {
    console.error("  Upload error:", JSON.stringify(data.errors).slice(0, 200));
    return null;
  }
  return data.doc.id;
}

async function updateEditorial(payloadSlug, imageId) {
  // Find the editorial by slug
  const res = await fetch(
    `${PAYLOAD_URL}/api/editorials?where[slug][equals]=${encodeURIComponent(payloadSlug)}`,
    { headers: { Authorization: `JWT ${PAYLOAD_TOKEN}` } },
  );
  const data = await res.json();
  if (!data.docs?.length) {
    console.error(`  Not found: ${payloadSlug}`);
    return;
  }
  const id = data.docs[0].id;

  const updateRes = await fetch(`${PAYLOAD_URL}/api/editorials/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `JWT ${PAYLOAD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image: imageId }),
  });
  const updateData = await updateRes.json();
  if (updateData.errors) {
    console.error("  Update error:", JSON.stringify(updateData.errors).slice(0, 200));
  }
}

async function main() {
  const data = await datoQuery(`{
    allEditorials(orderBy: date_DESC) {
      title slug
      image { url }
    }
  }`);

  for (const post of data.allEditorials) {
    if (!post.image?.url) {
      console.log(`${post.title} — no image, skipping`);
      continue;
    }

    console.log(`${post.title}`);
    console.log(`  Uploading...`);
    const mediaId = await uploadToPayload(post.image.url, post.title);
    if (!mediaId) continue;

    console.log(`  Uploaded: ${mediaId}, attaching to editorial...`);
    await updateEditorial(post.slug, mediaId);
    console.log(`  ✅ Done`);
  }

  console.log("\n🎉 All images migrated!");
}

main().catch(console.error);
