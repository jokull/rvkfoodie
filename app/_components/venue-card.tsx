import { Icon } from "./icon";


export function VenueCard({
  id,
  name,
  address,
  description,
  note,
  time,
  openingHours,
  googleMapsUrl,
  bestOfAward,
  grapevineUrl,
  image,
}: {
  id?: string;
  name: string;
  address: string;
  description: string;
  note?: string;
  time?: string;
  openingHours?: string;
  googleMapsUrl?: string;
  bestOfAward?: string;
  grapevineUrl?: string;
  image?: { url: string; alt?: string };
}) {
  const mapsUrl =
    googleMapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address} Iceland`)}`;
  const imgUrl = image?.url ?? null;

  return (
    <article className="py-8 border-b border-ink/5 last:border-0">
      {time && (
        <p className="text-tiny leading-tiny text-blue font-medium tracking-wide uppercase mb-2">
          {time}
        </p>
      )}
      {bestOfAward && (
        <p className="text-tiny font-medium mb-2">
          {grapevineUrl ? (
            <a
              href={grapevineUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-blue hover:opacity-80 transition-opacity"
            >
              <Icon name="trophy" className="w-4 h-4" />
              {bestOfAward}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-blue">
              <Icon name="trophy" className="w-4 h-4" />
              {bestOfAward}
            </span>
          )}
        </p>
      )}
      <div className={imgUrl ? "flex gap-5 items-start" : undefined}>
        {imgUrl && (
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden shrink-0">
            <img
              src={imgUrl}
              alt={image?.alt ?? name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[1.75rem] leading-tight mb-1">
            {id ? (
              <a
                href={`/places/${id}`}
                className="hover:text-blue transition-colors"
              >
                {name}
              </a>
            ) : (
              name
            )}
          </h3>
          {address && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener"
              className="text-tiny leading-tiny text-ink-light hover:text-blue transition-colors"
            >
              {address} ↗
            </a>
          )}
          <p className="mt-3">{description}</p>
          {note && (
            <p className="mt-2 text-tiny leading-tiny text-ink-light/70">
              {note}
            </p>
          )}
          {openingHours && (
            <p className="mt-2 text-tiny leading-tiny text-ink-light">
              {openingHours}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
