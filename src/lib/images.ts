const R2_MEDIA_URL = "https://media.rvkfoodie.is";
const PAYLOAD_MEDIA_URL = "https://rvkfoodie-cms.solberg.workers.dev";

/**
 * Convert a Payload media URL to the fast R2 custom domain URL.
 * Falls back to Payload URL if the image path can't be resolved.
 */
export function mediaUrl(
  urlOrFilename: string,
  width?: number,
): string {
  // Extract just the filename from Payload URLs like /api/media/file/image.jpg
  let filename = urlOrFilename;
  if (filename.includes("/api/media/file/")) {
    filename = filename.split("/api/media/file/").pop()!;
  }
  if (filename.startsWith("http")) {
    // Full URL — extract filename from path
    try {
      const url = new URL(filename);
      filename = url.pathname.split("/").pop()!;
    } catch {
      return urlOrFilename;
    }
  }

  return `${R2_MEDIA_URL}/${filename}`;
}

/**
 * Get the full Payload URL for a media file (fallback).
 */
export function payloadMediaUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${PAYLOAD_MEDIA_URL}${path}`;
}
