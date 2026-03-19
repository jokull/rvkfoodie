import { getAllGuides, getAllEditorials, type SectionBlock } from "@/lib/cms";

export async function GET() {
  const [guides, editorials] = await Promise.all([
    getAllGuides(),
    getAllEditorials(),
  ]);

  const base = "https://www.rvkfoodie.is";
  const today = new Date().toISOString().split("T")[0];

  const urls: Array<{
    loc: string;
    priority: string;
    changefreq: string;
    lastmod?: string;
  }> = [
    { loc: "/", priority: "1.0", changefreq: "weekly" },
    { loc: "/about", priority: "0.6", changefreq: "monthly" },
    { loc: "/changelog", priority: "0.7", changefreq: "weekly" },
  ];

  for (const guide of guides) {
    urls.push({
      loc: `/guides/${guide.slug}`,
      priority: "0.9",
      changefreq: "weekly",
    });
    for (const block of guide.content) {
      if (block.blockType === "section") {
        for (const venue of (block as SectionBlock).venues) {
          urls.push({
            loc: `/places/${venue.id}`,
            priority: "0.7",
            changefreq: "monthly",
          });
        }
      }
    }
  }

  for (const post of editorials) {
    urls.push({
      loc: `/blog/${post.slug}`,
      priority: "0.8",
      changefreq: "monthly",
      lastmod: post.date?.split("T")[0],
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${base}${u.loc}</loc>
    <lastmod>${u.lastmod ?? today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
