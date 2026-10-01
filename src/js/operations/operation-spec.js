export const OPERATION_SPEC_VERSION = 1;

export const ARGUMENT_ROLE = Object.freeze({
  VALUE: 'value',
  SYMBOLIC: 'symbolic',
  SCOPED: 'scoped',
});

export const OPERATION_PURITY = Object.freeze({
  PURE: 'pure',
  VOLATILE: 'volatile',
});

function fail(message) {
  throw new TypeError(`OperationSpec: ${message}`);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function validateRole(role) {
  if (!Object.values(ARGUMENT_ROLE).includes(role)) fail(`unknown argument role: ${String(role)}`);
  return role;
}

function argumentSpec(argument, { allowVariadic = true } = {}) {
  if (!argument || typeof argument !== 'object' || Array.isArray(argument)) {
    fail('argument specification must be an object');
  }

  const role = validateRole(argument.role);
  const variadic = argument.variadic === true;

  const allowed = ['name', 'role'];
  if (role === ARGUMENT_ROLE.SCOPED) allowed.push('scopeOver');
  if (variadic) allowed.push('variadic');

  const keys = Object.keys(argument).sort();
  const expected = [...allowed].sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
    fail(`argument specification for role ${role} must contain exactly ${expected.join(', ')}`);
  }

  if (!allowVariadic && variadic) fail('variadic argument is not allowed here');

  const result = {
    name: nonEmptyString(argument.name, 'argument name'),
    role,
  };

  if (role === ARGUMENT_ROLE.SCOPED) {
    if (!Array.isArray(argument.scopeOver)) fail('scoped argument scopeOver must be an array');
    result.scopeOver = Object.freeze(argument.scopeOver.map((name) =>
      nonEmptyString(name, 'scopeOver target')));
  }

  if (variadic) result.variadic = true;

  return Object.freeze(result);
}

function validateArguments(argumentDefinitions, label) {
  if (!Array.isArray(argumentDefinitions)) fail(`${label} must be an array`);

  const args = argumentDefinitions.map((argument) => argumentSpec(argument));
  const names = new Set();

  for (const argument of args) {
    if (names.has(argument.name)) fail(`duplicate argument name: ${argument.name}`);
    names.add(argument.name);
  }

  const variadicIndexes = args
    .map((argument, index) => argument.variadic === true ? index : -1)
    .filter((index) => index >= 0);

  if (variadicIndexes.length > 1) fail('a signature may contain at most one variadic argument');
  if (variadicIndexes.length === 1 && variadicIndexes[0] !== args.length - 1) {
    fail('variadic argument must be the final argument in a signature');
  }

  for (const argument of args) {
    if (argument.role !== ARGUMENT_ROLE.SCOPED) continue;
    const seenTargets = new Set();
    for (const target of argument.scopeOver) {
      if (!names.has(target)) fail(`unknown scopeOver target: ${target}`);
      if (target === argument.name) fail(`scoped argument cannot scope over itself: ${target}`);
      if (seenTargets.has(target)) fail(`duplicate scopeOver target: ${target}`);
      seenTargets.add(target);
    }
  }

  return Object.freeze(args);
}

function signatureSpec(signature) {
  if (!signature || typeof signature !== 'object' || Array.isArray(signature)) {
    fail('signature must be an object');
  }
  const keys = Object.keys(signature).sort();
  if (keys.length !== 1 || keys[0] !== 'arguments') {
    fail('signature must contain exactly arguments');
  }
  return Object.freeze({
    arguments: validateArguments(signature.arguments, 'signature arguments'),
  });
}

export function operationSpec({
  operationId,
  evaluatorId,
  arguments: argumentDefinitions,
  signatures: signatureDefinitions,
  purity = OPERATION_PURITY.PURE,
  diagnosticAdapterId = null,
}) {
  nonEmptyString(operationId, 'operationId');
  nonEmptyString(evaluatorId, 'evaluatorId');

  const hasArguments = argumentDefinitions !== undefined;
  const hasSignatures = signatureDefinitions !== undefined;

  if (hasArguments && hasSignatures) fail('use either arguments or signatures, not both');
  if (!hasArguments && !hasSignatures) argumentDefinitions = [];

  let signatures;
  if (hasSignatures) {
    if (!Array.isArray(signatureDefinitions) || signatureDefinitions.length === 0) {
      fail('signatures must be a non-empty array');
    }
    signatures = Object.freeze(signatureDefinitions.map(signatureSpec));
  } else {
    signatures = Object.freeze([
      Object.freeze({ arguments: validateArguments(argumentDefinitions, 'arguments') }),
    ]);
  }

  if (!Object.values(OPERATION_PURITY).includes(purity)) fail(`unknown purity: ${String(purity)}`);
  if (diagnosticAdapterId !== null) nonEmptyString(diagnosticAdapterId, 'diagnosticAdapterId');

  // Compatibility view for the common one-signature case. Semantic consumers
  // should migrate toward signatures; this alias carries no additional policy.
  const argumentsView = signatures.length === 1 ? signatures[0].arguments : undefined;

  const result = {
    operationSpecVersion: OPERATION_SPEC_VERSION,
    operationId,
    evaluatorId,
    signatures,
    purity,
    diagnosticAdapterId,
  };
  if (argumentsView !== undefined) result.arguments = argumentsView;

  return Object.freeze(result);
}

export function isOperationSpec(value) {
  if (!value || typeof value !== 'object' || !Object.isFrozen(value) ||
      value.operationSpecVersion !== OPERATION_SPEC_VERSION) return false;
  try {
    const rebuilt = operationSpec({
      operationId: value.operationId,
      evaluatorId: value.evaluatorId,
      signatures: value.signatures,
      purity: value.purity,
      diagnosticAdapterId: value.diagnosticAdapterId,
    });

    const allowed = new Set(Object.keys(rebuilt));
    if (value.signatures.length === 1) allowed.add('arguments');
    if (Object.keys(value).some((key) => !allowed.has(key))) return false;

    if (!Object.isFrozen(value.signatures)) return false;
    for (const signature of value.signatures) {
      if (!Object.isFrozen(signature) || !Object.isFrozen(signature.arguments)) return false;
      for (const argument of signature.arguments) {
        if (!Object.isFrozen(argument)) return false;
        if (argument.role === ARGUMENT_ROLE.SCOPED && !Object.isFrozen(argument.scopeOver)) return false;
      }
    }

    if (value.signatures.length === 1 && value.arguments !== value.signatures[0].arguments) return false;
    if (value.signatures.length > 1 && 'arguments' in value) return false;
    return true;
  } catch {
    return false;
  }
}
