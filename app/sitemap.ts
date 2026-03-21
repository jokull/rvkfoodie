import { getAllGuides, getAllEditorials, venueUrl } from "@/lib/cms";

interface SitemapEntry {
  url: string;
  lastModified?: string;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

export default async function sitemap(): Promise<SitemapEntry[]> {
  const [guides, editorials] = await Promise.all([
    getAllGuides(),
    getAllEditorials(),
  ]);

  const today = new Date().toISOString().split("T")[0];

  const entries: SitemapEntry[] = [
    { url: "https://www.rvkfoodie.is", lastModified: today, changeFrequency: "weekly", priority: 1.0 },
    { url: "https://www.rvkfoodie.is/about", lastModified: today, changeFrequency: "monthly", priority: 0.6 },
    { url: "https://www.rvkfoodie.is/changelog", lastModified: today, changeFrequency: "weekly", priority: 0.7 },
  ];

  for (const guide of guides) {
    entries.push({
      url: `https://www.rvkfoodie.is/guides/${guide.slug}`,
      lastModified: today,
      changeFrequency: "weekly",
      priority: 0.9,
    });
    for (const block of guide.content) {
      if (block.blockType === "section") {
        for (const venue of block.venues) {
          entries.push({
            url: `https://www.rvkfoodie.is${venueUrl(venue)}`,
            lastModified: today,
            changeFrequency: "monthly",
            priority: 0.7,
          });
        }
      }
    }
  }

  for (const post of editorials) {
    entries.push({
      url: `https://www.rvkfoodie.is/blog/${post.slug}`,
      lastModified: post.date?.split("T")[0] ?? today,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  return entries;
}
