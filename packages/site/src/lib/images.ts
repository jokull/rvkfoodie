const R2_MEDIA_URL = "https://media.rvkfoodie.is";

/**
 * Get the public URL for a media asset.
 * agent-cms returns URLs like /assets/{id}/{filename} but R2 stores
 * files at the root. Always extract the filename and build the R2 URL.
 */
export function mediaUrl(urlOrFilename: string): string {
  // Extract just the filename from any path format
  const filename = urlOrFilename.split("/").pop() ?? urlOrFilename;
  return `${R2_MEDIA_URL}/${filename}`;
}
