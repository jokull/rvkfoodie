type ResponsiveImageData = {
  src: string;
  srcSet: string;
  webpSrcSet: string;
  width: number;
  height: number;
  sizes: string;
};

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
      <source srcSet={data.webpSrcSet} type="image/webp" sizes={data.sizes} />
      <source srcSet={data.srcSet} sizes={data.sizes} />
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
