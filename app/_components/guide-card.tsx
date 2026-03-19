export function GuideCard({
  title,
  subtitle,
  description,
  price,
  slug,
  unlocked,
}: {
  title: string;
  subtitle: string;
  description: string;
  price: number;
  slug: string;
  unlocked: boolean;
}) {
  return (
    <a
      href={`/guides/${slug}`}
      className="block border border-ink/10 rounded-2xl p-8 hover:border-ink/25 transition-colors group"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h2 className="font-display text-[1.75rem] leading-tight group-hover:text-blue transition-colors">
          {title}
        </h2>
        {unlocked ? (
          <span className="text-tiny text-blue font-medium whitespace-nowrap mt-1">
            Unlocked
          </span>
        ) : (
          <span className="text-tiny text-ink-light whitespace-nowrap mt-1">
            ${price}
          </span>
        )}
      </div>
      <p className="text-tiny leading-tiny text-ink-light mb-3">{subtitle}</p>
      <p className="text-ink-light">{description}</p>
    </a>
  );
}
