import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl,
  generateSlug,
  parseBookmarks,
  formatBookmark,
  STORAGE_KEY,
} from './bookmarks.ts';

test('STORAGE_KEY is the expected localStorage key', () => {
  assert.equal(STORAGE_KEY, 'mona-bookmarks');
});

test('normalizeUrl: adds https:// when no scheme is given', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com');
});

test('normalizeUrl: URL with and without https:// normalises to the same value', () => {
  const withScheme = normalizeUrl('https://www.example.com');
  const withoutScheme = normalizeUrl('www.example.com');
  assert.equal(withScheme, withoutScheme);
  assert.equal(withScheme, 'https://www.example.com');
});

test('normalizeUrl: trims whitespace and preserves path/query', () => {
  assert.equal(
    normalizeUrl('  example.com/path?q=1  '),
    'https://example.com/path?q=1'
  );
});

test('normalizeUrl: is idempotent for already-normalised URLs', () => {
  const first = normalizeUrl('example.com');
  const second = normalizeUrl(first!);
  assert.equal(first, second);
});

test('normalizeUrl: rejects empty or invalid input without throwing', () => {
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('   '), null);
  assert.equal(normalizeUrl('not a url'), null);
});

test('normalizeUrl: rejects non-http(s) schemes', () => {
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('ftp://example.com'), null);
});

test('generateSlug: has the mona- prefix and a base62 body', () => {
  const slug = generateSlug();
  assert.match(slug, /^mona-[A-Za-z0-9]{4}$/);
});

test('generateSlug: avoids collisions with existing slugs', () => {
  const existing = new Set(['mona-aaaa']);
  const original = Math.random;
  let calls = 0;
  Math.random = () => {
    calls += 1;
    // First 4 calls produce "aaaa" (colliding), subsequent calls produce "b".
    return calls <= 4 ? 0 : 27 / 62; // index 0 -> 'A', index 27 -> 'b'
  };
  try {
    const slug = generateSlug(existing);
    assert.notEqual(slug, 'mona-aaaa');
  } finally {
    Math.random = original;
  }
});

test('parseBookmarks: recovers from an empty stored value', () => {
  assert.deepEqual(parseBookmarks(''), []);
  assert.deepEqual(parseBookmarks(null), []);
  assert.deepEqual(parseBookmarks(undefined), []);
});

test('parseBookmarks: recovers from a corrupted (invalid JSON) stored value', () => {
  assert.deepEqual(parseBookmarks('{not json'), []);
  assert.deepEqual(parseBookmarks('undefined'), []);
});

test('parseBookmarks: recovers from a legacy/non-array stored value', () => {
  assert.deepEqual(parseBookmarks('{"url":"https://example.com"}'), []);
  assert.deepEqual(parseBookmarks('"just a string"'), []);
  assert.deepEqual(parseBookmarks('42'), []);
  assert.deepEqual(parseBookmarks('null'), []);
});

test('parseBookmarks: drops malformed entries but keeps valid ones', () => {
  const raw = JSON.stringify([
    { url: 'https://example.com', slug: 'mona-7fk2' },
    { url: 'https://missing-slug.com' },
    { slug: 'mona-nourl' },
    'not an object',
    null,
    42,
    { url: '', slug: 'mona-empty' },
    { url: 'https://ok.com', slug: 'mona-ok1' },
  ]);
  assert.deepEqual(parseBookmarks(raw), [
    { url: 'https://example.com', slug: 'mona-7fk2' },
    { url: 'https://ok.com', slug: 'mona-ok1' },
  ]);
});

test('formatBookmark: uses the exact " :: " separator', () => {
  const formatted = formatBookmark({
    url: 'https://www.example.com',
    slug: 'mona-7fk2',
  });
  assert.equal(formatted, 'https://www.example.com :: mona-7fk2');
});
