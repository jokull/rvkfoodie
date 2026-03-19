import { getSiteSettings } from "@/lib/cms";

export async function RestaurantCallout() {
  const settings = await getSiteSettings();

  return (
    <div className="border border-ink/10 rounded-2xl p-8">
      <p className="font-display text-[1.25rem] leading-tight mb-2">
        {settings.restaurantCalloutTitle}
      </p>
      <p className="text-ink-light text-tiny mb-4">
        {settings.restaurantCalloutText}
      </p>
      <a
        href={`mailto:${settings.restaurantCalloutEmail}`}
        className="text-tiny text-blue hover:opacity-80 transition-opacity"
      >
        {settings.restaurantCalloutEmail} →
      </a>
    </div>
  );
}
