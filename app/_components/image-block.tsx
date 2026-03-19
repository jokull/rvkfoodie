import { mediaUrl } from "@/lib/images";

export function ImageBlock({
  block,
}: {
  block: {
    id: string;
    image: {
      url: string;
      alt: string | null;
      filename: string;
      width: number | null;
      height: number | null;
    } | null;
    caption: string | null;
  };
}) {
  const src = block.image
    ? mediaUrl(block.image.filename || block.image.url)
    : null;

  if (!src) return null;

  return (
    <figure className="my-8 rounded-2xl overflow-hidden">
      <img
        src={src}
        alt={block.image?.alt || block.caption || ""}
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
