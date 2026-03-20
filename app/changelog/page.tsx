import type { Metadata } from "next";
import { getChangelogPageData } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Guide Updates",
  description: "Every update to our Reykjavík food guides, tracked.",
  alternates: { canonical: "/changelog" },
};

const typeLabel: Record<string, string> = {
  added: "Added",
  removed: "Removed",
  updated: "Updated",
};
const typeColor: Record<string, string> = {
  added: "text-green-700 bg-green-50",
  removed: "text-red-700 bg-red-50",
  updated: "text-blue bg-blue/5",
};

export default async function ChangelogPage() {
  const { entries, settings } = await getChangelogPageData();

  return (
    <>
      <h1 className="font-display text-huge leading-huge mb-4">
        Guide Updates
      </h1>
      <p className="text-ink-light mb-12">{settings.changelogSubtitle}</p>

      {entries.length === 0 ? (
        <div className="border border-ink/10 rounded-2xl p-8 text-center">
          <p className="text-ink-light">
            No changes logged yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {entries.map((entry, i) => {
            const prev = entries[i - 1];
            const showDate = !prev || prev.date !== entry.date;
            const dateStr = entry.date ? new Date(entry.date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }) : "";
            return (
              <div key={entry.id}>
                {showDate && (
                  <p className="text-tiny text-ink-light pt-8 pb-3 first:pt-0">
                    {dateStr}
                  </p>
                )}
                <div className="flex items-start gap-3 pb-4">
                  <span
                    className={`text-tiny font-medium px-2 py-0.5 rounded ${entry.changeType ? typeColor[entry.changeType] ?? "" : ""}`}
                  >
                    {entry.changeType ? typeLabel[entry.changeType] : ""}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{entry.title}</p>
                    {entry.description && (
                      <p className="text-ink-light text-tiny mt-1">
                        {entry.description}
                      </p>
                    )}
                    {entry.guide && typeof entry.guide === "object" && (
                      <a
                        href={`/guides/${entry.guide.slug}`}
                        className="text-tiny text-blue hover:opacity-80 transition-opacity mt-1 inline-block"
                      >
                        {entry.guide.title} →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
