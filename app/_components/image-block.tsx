export function ImageBlock({
  block,
}: {
  block: {
    id: string;
    image: {
      url: string;
      alt: string | null;
      width: number | null;
      height: number | null;
      responsiveImage?: {
        src: string;
        srcSet: string;
        webpSrcSet: string;
        width: number;
        height: number;
        sizes: string;
      } | null;
    } | null;
    caption: string | null;
  };
}) {
  if (!block.image?.url) return null;
  const ri = block.image.responsiveImage;

  return (
    <figure className="my-8 rounded-2xl overflow-hidden">
      {ri ? (
        <picture>
          <source srcSet={ri.webpSrcSet} type="image/webp" sizes={ri.sizes} />
          <source srcSet={ri.srcSet} sizes={ri.sizes} />
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
