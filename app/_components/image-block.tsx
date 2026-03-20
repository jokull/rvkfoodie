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
    } | null;
    caption: string | null;
  };
}) {
  if (!block.image?.url) return null;

  return (
    <figure className="my-8 rounded-2xl overflow-hidden">
      <img
        src={block.image.url}
        alt={block.image.alt || block.caption || ""}
        className="w-full rounded-2xl"
        loading="lazy"
      />
      {block.caption && (
        <figcaption className="text-tiny text-ink-light mt-2 text-center">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}
