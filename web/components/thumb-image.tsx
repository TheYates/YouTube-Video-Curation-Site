"use client";

// Thumbnail <img> with YouTube CDN fallback (maxres → hq). Client-only
// because of onError; safe to embed in server components.
export default function ThumbImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget;
        if (img.dataset.fbk) return;
        img.dataset.fbk = "1";
        img.src = img.src.replace(/maxresdefault|sddefault/, "hqdefault");
      }}
      className={className}
    />
  );
}
