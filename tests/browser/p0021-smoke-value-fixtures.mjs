/** Immutable Value fixture for browser smoke tests. No production changes. */
export function smokeIntegerValue(n) {
  if (!Number.isSafeInteger(n)) throw new TypeError('smoke integer must be safe integer');
  return Object.freeze({
    valueVersion: 1,
    kind: 'expression',
    data: Object.freeze({expr: Object.freeze({op: 'integer', value: String(n)})}),
  });
}
