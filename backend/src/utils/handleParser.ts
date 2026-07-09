/**
 * Extracts a clean alphanumeric handle from various social media inputs.
 * e.g., "https://instagram.com/my_store?igshid=123" -> "my_store"
 * e.g., "@my_store!" -> "mystore"
 */
export function extractSocialHandle(input: string): string {
  if (!input) return '';

  let handle = input.toLowerCase().trim();

  // 1. Strip out common domain URLs
  handle = handle.replace(/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|tiktok\.com|twitter\.com|x\.com)\//i, '');

  // 2. Strip URL query parameters (anything after '?')
  handle = handle.split('?')[0];

  // 3. Strip trailing slashes
  handle = handle.replace(/\/$/, '');

  // 4. Remove '@' and any non-alphanumeric characters (allow underscores and dashes)
  handle = handle.replace(/[^a-z0-9_-]/g, '');

  return handle;
}