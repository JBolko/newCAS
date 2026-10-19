/**
 * P0021 S95f — bounded, TEMPORARY variable-length test SOURCES.
 * Not .ncas, not persistence, not an EditingSession; no math parsing.
 */
export const S95F_VERSION = 'newCAS-test-sources-v2';
export const S95F_MAX_BYTES = 64 * 1024;
export const S95F_MAX_BLOCKS = 32;
export const S95F_MAX_SOURCE = 1024;
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const exact = (v, fields) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).sort().join('\0') === fields.slice().sort().join('\0');

export function validateS95fDrafts(blocks) {
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > S95F_MAX_BLOCKS)
    throw new TypeError('S95F_BLOCK_COUNT');
  const seen = new Set();
  const rows = [];
  for (const block of blocks) {
    if (!exact(block, ['id', 'source']) || typeof block.id !== 'string' ||
        !ID.test(block.id) || seen.has(block.id) ||
        typeof block.source !== 'string' || block.source.length > S95F_MAX_SOURCE ||
        block.source.includes('\0')) {
      throw new TypeError('S95F_BLOCK_INVALID');
    }
    seen.add(block.id);
    rows.push(Object.freeze({id: block.id, source: block.source}));
  }
  return Object.freeze(rows);
}

export function parseS95fTestFixture(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > S95F_MAX_BYTES)
    throw new TypeError('S95F_FIXTURE_SIZE');
  let json;
  try { json = JSON.parse(text); }
  catch { throw new TypeError('S95F_FIXTURE_JSON'); }
  if (!exact(json, ['fixtureVersion','blocks']) || json.fixtureVersion !== S95F_VERSION)
    throw new TypeError('S95F_FIXTURE_SHAPE');
  return validateS95fDrafts(json.blocks);
}
