import type { FragmentOf } from "gql.tada";
import type { ImageBlockFragment } from "@/lib/cms";

export function ImageBlock({
  block,
}: {
  block: FragmentOf<typeof ImageBlockFragment>;
}) {
  if (!block.image?.url) return null;
  const ri = block.image.responsiveImage;

  return (
    <figure className="my-8 rounded-2xl overflow-hidden">
      {ri ? (
        <picture>
          <source srcSet={ri.webpSrcSet} type="image/webp" sizes={ri.sizes ?? undefined} />
          <source srcSet={ri.srcSet} sizes={ri.sizes ?? undefined} />
          <img
            src={ri.src}
            width={ri.width}
            height={ri.height}
            alt={(block.image.alt ?? block.caption) ?? ""}
            className="w-full rounded-2xl"
            loading="lazy"
          />
        </picture>
      ) : (
        <img
          src={block.image.url}
          alt={(block.image.alt ?? block.caption) ?? ""}
          className="w-full rounded-2xl"
          loading="lazy"
        />
      )}
      {block.caption && (
        <figcaption className="text-tiny text-ink-light mt-2 text-center">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}
