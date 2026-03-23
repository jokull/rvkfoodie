import type { FragmentOf } from "gql.tada";
import type { ResponsiveImageFragment } from "@/lib/cms";

type ResponsiveImageData = NonNullable<
  FragmentOf<typeof ResponsiveImageFragment>["responsiveImage"]
>;

export function ResponsiveImage({
  data,
  alt,
  className,
  loading = "lazy",
}: {
  data: ResponsiveImageData;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <picture>
      <source srcSet={data.webpSrcSet} type="image/webp" sizes={data.sizes ?? undefined} />
      <source srcSet={data.srcSet} sizes={data.sizes ?? undefined} />
      <img
        src={data.src}
        width={data.width}
        height={data.height}
        alt={alt}
        className={className}
        loading={loading}
      />
    </picture>
  );
}
