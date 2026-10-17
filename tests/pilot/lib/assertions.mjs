import assert from 'node:assert/strict';

/** Fejler med en læsbar liste (uden node:assert's diff-støj), hvis listen ikke er tom. */
export function none(list, header) {
  assert.ok(list.length === 0, `${header}\n  ${list.join('\n  ')}`);
}
