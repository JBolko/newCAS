/**
 * Legacy-only boundary: parse a *unit expression*, not arbitrary Python.
 *
 * This belongs to the retiring source->Python adapter, never the P0021
 * Semantic IR, Value, OperationSpec or stateless Worker contracts.
 * The known names mirror those actually exported by legacy UNITS/context.py.
 */
const KNOWN = Object.freeze({
  m:'m', meter:'meter', km:'km', cm:'cm', mm:'mm',
  s:'s', second:'second', min:'minute', minute:'minute',
  h:'h', hour:'hour', kg:'kg', gram:'gram', g:'gram', mg:'mg',
  K:'K', kelvin:'kelvin', C:'C', celsius:'celsius',
  N:'newton', newton:'newton', J:'J', joule:'joule',
  W:'W', watt:'watt', Pa:'Pa', pascal:'pascal', bar:'bar',
  A:'A', ampere:'ampere', mA:'mA', milliampere:'milliampere',
});

/** Fail closed: an unknown unit is NOT a Python variable or callable. */
function invalid(reason) { throw new SyntaxError(`Legacy unit expression: ${reason}`); }

function parseLegacyUnit(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128)
    invalid('unit must be a non-empty bounded string');
  let i = 0;
  let nodes = 0;
  function ws() { while (i < raw.length && /[ \t\r\n]/.test(raw[i])) i++; }
  function token(ch) { ws(); if (raw[i] === ch) { i++; return true; } return false; }
  function atom(depth) {
    ws();
    if (++nodes > 64 || depth > 8) invalid('expression too complex');
    if (token('(')) {
      const nested = product(depth + 1);
      if (!token(')')) invalid('expected closing parenthesis');
      return `(${nested})`;
    }
    const match = /^[A-Za-z][A-Za-z0-9]*/.exec(raw.slice(i));
    if (!match) invalid('expected unit name');
    i += match[0].length;
    if (!Object.hasOwn(KNOWN, match[0])) invalid(`unsupported unit: ${match[0]}`);
    return KNOWN[match[0]];
  }
  function factor(depth) {
    let result = atom(depth);
    if (token('^')) {
      const negative = token('-');
      if (!negative) token('+');
      const number = /^[0-9]{1,2}/.exec(raw.slice(i));
      if (!number) invalid('expected integer exponent');
      i += number[0].length;
      const exponent = Number(number[0]) * (negative ? -1 : 1);
      if (Math.abs(exponent) > 12) invalid('exponent outside supported range');
      result = `(${result} ** ${exponent})`;
    }
    return result;
  }
  function product(depth) {
    let result = factor(depth);
    for (;;) {
      if (token('*')) result = `(${result} * ${factor(depth)})`;
      else if (token('/')) result = `(${result} / ${factor(depth)})`;
      else break;
    }
    return result;
  }
  const python = product(0);
  ws();
  if (i !== raw.length) invalid(`unexpected token at position ${i}`);
  return python;
}

/** Validated, syntax-only unit arithmetic for legacy Quantity emission. */
export function compileLegacyQuantityUnit(raw) {
  return parseLegacyUnit(raw);
}

/**
 * Legacy convert_to_unit accepts a *single named unit*, not a unit expression.
 * Return a safely quoted literal; never interpolate source text into Python.
 */
export function compileLegacyConversionUnit(raw) {
  if (typeof raw !== 'string') invalid('target must be a string');
  const name = raw.trim();
  if (!Object.hasOwn(KNOWN, name)) invalid('conversion target must be a known single unit');
  return JSON.stringify(KNOWN[name]);
}
