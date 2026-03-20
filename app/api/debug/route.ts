import {
  getHomePage,
  getAboutPage,
  getAllGuides,
  getAllEditorials,
  getSiteSettings,
} from "@/lib/cms";
import { dastToHtml } from "@/lib/dast";

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const test = url.searchParams.get("t") ?? "home";
  try {
    if (test === "home") {
      const data = await getHomePage();
      return json({ ok: true, data });
    }
    if (test === "about") {
      const data = await getAboutPage();
      const bioHtml = dastToHtml(data.bio);
      return json({
        ok: true,
        title: data.title,
        bioLength: bioHtml.length,
      });
    }
    if (test === "editorials") {
      const editorials = await getAllEditorials();
      return json({
        ok: true,
        count: editorials.length,
        first: editorials[0]?.title,
      });
    }
    if (test === "guides") {
      const guides = await getAllGuides();
      return json({
        ok: true,
        count: guides.length,
        first: guides[0]?.title,
        blocks: guides[0]?.content.length,
      });
    }
    if (test === "settings") {
      const data = await getSiteSettings();
      return json({ ok: true, data });
    }
    return json({ error: "unknown test" });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: String(e),
        stack: (e as Error).stack?.split("\n").slice(0, 5),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
