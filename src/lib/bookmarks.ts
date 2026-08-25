// Pure helpers for Mona's Bookmark Manager.
//
// Nothing in this module touches the DOM, localStorage, or any other
// browser-only API — it only reads/transforms plain data. That makes it
// safe to import from the static Astro build AND to unit test with plain
// `node --test`, no browser required. All localStorage reads/writes happen
// in the client <script> in Bookmarks.astro, using these helpers.

export const STORAGE_KEY = 'mona-bookmarks';

export interface Bookmark {
  url: string;
  slug: string;
}

const BASE62_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Normalise a user-typed URL so "example.com" and "https://example.com"
 * (and "HTTPS://Example.com/") all end up saved as the same value.
 *
 * Returns null when the input can't be turned into a valid http(s) URL.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) return null;

  // Add a scheme when none is present so bare "example.com" style input
  // still parses. Anything already carrying a scheme (http/https/etc.) is
  // left alone so we don't mangle it.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // Normalise scheme/host casing (URL already lowercases host), and drop a
  // bare trailing "/" so "example.com" and "example.com/" match too.
  let normalized = parsed.toString();
  if (parsed.pathname === '/' && !parsed.search && !parsed.hash) {
    normalized = normalized.replace(/\/$/, '');
  }
  return normalized;
}

/**
 * Generate a short base62 slug with a "mona-" prefix, e.g. "mona-7fk2".
 * Accepts an optional set of slugs already in use so a fresh, unique one
 * is produced even if random collisions occur.
 */
export function generateSlug(existingSlugs: ReadonlySet<string> = new Set()): string {
  let slug: string;
  do {
    let body = '';
    for (let i = 0; i < 4; i++) {
      body += BASE62_ALPHABET[Math.floor(Math.random() * BASE62_ALPHABET.length)];
    }
    slug = `mona-${body}`;
  } while (existingSlugs.has(slug));
  return slug;
}

function isBookmark(value: unknown): value is Bookmark {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.url === 'string' &&
    candidate.url.length > 0 &&
    typeof candidate.slug === 'string' &&
    candidate.slug.length > 0
  );
}

/**
 * Parse and validate a raw localStorage string into a clean bookmark list.
 * Never throws: empty, corrupted (invalid JSON), legacy (wrong shape), or
 * non-array values all safely recover to an empty list, and any malformed
 * entries inside an otherwise-valid array are dropped individually.
 */
export function parseBookmarks(raw: string | null | undefined): Bookmark[] {
  if (!raw) return [];

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(data)) return [];

  return data.filter(isBookmark).map((entry) => ({ url: entry.url, slug: entry.slug }));
}

/** Serialize a bookmark list for storage. */
export function serializeBookmarks(bookmarks: readonly Bookmark[]): string {
  return JSON.stringify(bookmarks);
}

/**
 * Format a bookmark for display with the exact " :: " separator, e.g.
 * "https://www.example.com :: mona-7fk2".
 */
export function formatBookmark(bookmark: Bookmark): string {
  return `${bookmark.url} :: ${bookmark.slug}`;
}
