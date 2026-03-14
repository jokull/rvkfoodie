import { buildClient } from "@datocms/cma-client-node";

const client = buildClient({ apiToken: "69c83b30ebff185771188e058ddce6" });

const IMAGE_BLOCK_ID = "f7EfdnRRTfCC4DDAg5N5eg";

const posts = [
  {
    recordId: "Vy3QVANTSayYjxOv1OOhbg",
    title: "Vínstúkan Sunday Feast",
    dir: "/tmp/ig-downloads/-DT5Tx8PjBoM",
    prefix: "2026-01-24_13-40-44_UTC",
    count: 6,
  },
  {
    recordId: "cfX_3yI_QRihiq2Woi6Afw",
    title: "Slippurinn Farewell",
    dir: "/tmp/ig-downloads/-DQzDv42jPUF",
    prefix: "2025-11-08_13-51-01_UTC",
    count: 12,
  },
  {
    recordId: "cECUDEN_QfaTV-7ZvgEhkQ",
    title: "Næs Westman Islands",
    dir: "/tmp/ig-downloads/-DMhtxwrIiL3",
    prefix: "2025-07-25_10-06-22_UTC",
    count: 9,
  },
  {
    recordId: "FBX0AYJSRUae7YTr90APSA",
    title: "Austur-Indía 30th",
    dir: "/tmp/ig-downloads/-DJtg5sQgC_H",
    prefix: "2025-05-16_10-30-00_UTC",
    count: 8,
  },
  {
    recordId: "e87Nxvl3ShqBI2_kC464nQ",
    title: "Coocoo's Nest at Harpa",
    dir: "/tmp/ig-downloads/-DAYa1AFgAaP",
    prefix: "2024-09-26_13-10-54_UTC",
    count: 7,
  },
  {
    recordId: "F6b3Di9GTX2Ml0ObP9RQQw",
    title: "Skál! New Space",
    dir: "/tmp/ig-downloads/-DAIo5CUguug",
    prefix: "2024-09-20_10-05-56_UTC",
    count: 7,
  },
];

for (const post of posts) {
  console.log(`\n=== ${post.title} ===`);

  // Upload hero image (first image)
  const heroPath = `${post.dir}/${post.prefix}_1.jpg`;
  console.log(`Uploading hero: ${heroPath}`);
  const hero = await client.uploads.createFromLocalFile({
    localPath: heroPath,
    default_field_metadata: {
      is: {
        alt: post.title,
        title: null,
        custom_data: {},
        focal_point: null,
      },
    },
  });
  console.log(`  Hero uploaded: ${hero.id}`);

  // Upload extra images
  const extraUploads = [];
  for (let i = 2; i <= Math.min(post.count, 6); i++) {
    const path = `${post.dir}/${post.prefix}_${i}.jpg`;
    console.log(`  Uploading image ${i}...`);
    const upload = await client.uploads.createFromLocalFile({
      localPath: path,
      default_field_metadata: {
        is: {
          alt: `${post.title} - photo ${i}`,
          title: null,
          custom_data: {},
          focal_point: null,
        },
      },
    });
    extraUploads.push(upload);
  }

  // Get existing record content
  const existing = await client.items.find(post.recordId, { nested: true });
  const existingContent = existing.content;

  // Build image blocks
  const imageBlocks = extraUploads.map((upload) => ({
    type: "block",
    item: {
      type: "item",
      attributes: {
        image: { upload_id: upload.id },
      },
      relationships: {
        item_type: {
          data: { type: "item_type", id: IMAGE_BLOCK_ID },
        },
      },
    },
  }));

  // Add image blocks after the content paragraphs
  const children = [...existingContent.document.children];
  // Insert after 2nd paragraph, or at end if short
  const insertAt = Math.min(2, children.length);
  children.splice(insertAt, 0, ...imageBlocks);

  await client.items.update(post.recordId, {
    image: { upload_id: hero.id },
    content: {
      schema: "dast",
      document: {
        type: "root",
        children,
      },
    },
  });

  console.log(`  ✅ ${post.title} updated with hero + ${extraUploads.length} inline images`);
}

console.log("\n🎉 All posts updated with images!");
