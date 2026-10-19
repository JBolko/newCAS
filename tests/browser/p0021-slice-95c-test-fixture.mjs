/**
 * P0021 S95c: test-only source fixture ingestion (NOT .ncas persistence).
 * Data only. Never parses mathematics, evaluates, edits DocumentRuntime or
 * allocates IDs. Existing S95b draft inputs are the sole ingestion target.
 */
export const S95C_MAX_FIXTURE_BYTES = 16 * 1024;
export const S95C_FIXTURE_VERSION = 'newCAS-test-sources-v1';
export const S95C_PILOT_BLOCK_IDS = Object.freeze(['pilot-a', 'pilot-f', 'pilot-result']);

function exactKeys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
}

export function parseS95cTestFixture(source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > S95C_MAX_FIXTURE_BYTES) {
    throw new TypeError('S95C_FIXTURE_SIZE');
  }
  let json;
  try { json = JSON.parse(source); }
  catch { throw new TypeError('S95C_FIXTURE_JSON'); }

  if (!exactKeys(json, ['fixtureVersion', 'blocks']) ||
      json.fixtureVersion !== S95C_FIXTURE_VERSION ||
      !Array.isArray(json.blocks) || json.blocks.length !== S95C_PILOT_BLOCK_IDS.length) {
    throw new TypeError('S95C_FIXTURE_SHAPE');
  }

  const sources = new Map();
  for (const block of json.blocks) {
    if (!exactKeys(block, ['id', 'source']) ||
        !S95C_PILOT_BLOCK_IDS.includes(block.id) || sources.has(block.id) ||
        typeof block.source !== 'string' || block.source.length > 1024 ||
        block.source.includes('\0')) {
      throw new TypeError('S95C_FIXTURE_BLOCK');
    }
    sources.set(block.id, block.source);
  }
  if (sources.size !== S95C_PILOT_BLOCK_IDS.length) throw new TypeError('S95C_FIXTURE_IDS');
  return Object.freeze(S95C_PILOT_BLOCK_IDS.map(id =>
    Object.freeze({id, source: sources.get(id)})));
}
