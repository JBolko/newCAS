// P0006 — Semantic identity contract, slice 1.
// Pure identity/scoping layer: no parser, evaluator, backend or DocumentRuntime.

const IDENTITY_VERSION = 1;
const KINDS = new Set(['free-symbol', 'binder', 'operation-local']);

function fail(message) {
  throw new TypeError(`SemanticIdentity: ${message}`);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function freezeIdentity(kind, data) {
  return Object.freeze({
    identityVersion: IDENTITY_VERSION,
    kind,
    ...data,
  });
}

export function freeSymbolIdentity(taskScopeId, name) {
  return freezeIdentity('free-symbol', {
    taskScopeId: nonEmptyString(taskScopeId, 'taskScopeId'),
    name: nonEmptyString(name, 'name'),
  });
}

export function binderIdentity(id, displayName) {
  return freezeIdentity('binder', {
    id: nonEmptyString(id, 'binder id'),
    displayName: nonEmptyString(displayName, 'displayName'),
  });
}

export function operationLocalIdentity(id, displayName) {
  return freezeIdentity('operation-local', {
    id: nonEmptyString(id, 'operation-local id'),
    displayName: nonEmptyString(displayName, 'displayName'),
  });
}

export function isSemanticIdentity(value) {
  if (!value || typeof value !== 'object' || !Object.isFrozen(value)) return false;
  if (value.identityVersion !== IDENTITY_VERSION) return false;
  if (!KINDS.has(value.kind)) return false;

  try {
    switch (value.kind) {
      case 'free-symbol':
        nonEmptyString(value.taskScopeId, 'taskScopeId');
        nonEmptyString(value.name, 'name');
        return Object.keys(value).length === 4;
      case 'binder':
      case 'operation-local':
        nonEmptyString(value.id, 'id');
        nonEmptyString(value.displayName, 'displayName');
        return Object.keys(value).length === 4;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export function identityKey(identity) {
  if (!isSemanticIdentity(identity)) fail('invalid identity');

  switch (identity.kind) {
    case 'free-symbol':
      return `free-symbol:${JSON.stringify(identity.taskScopeId)}:${JSON.stringify(identity.name)}`;
    case 'binder':
      return `binder:${JSON.stringify(identity.id)}`;
    case 'operation-local':
      return `operation-local:${JSON.stringify(identity.id)}`;
    default:
      fail('unknown identity kind');
  }
}

export function sameIdentity(left, right) {
  return isSemanticIdentity(left)
    && isSemanticIdentity(right)
    && identityKey(left) === identityKey(right);
}

function displayNameOf(identity) {
  return identity.kind === 'free-symbol' ? identity.name : identity.displayName;
}

export class LexicalIdentityScope {
  #taskScopeId;
  #frames;

  constructor(taskScopeId, frames = []) {
    this.#taskScopeId = nonEmptyString(taskScopeId, 'taskScopeId');
    this.#frames = frames;
    Object.freeze(this);
  }

  push(identities) {
    if (!Array.isArray(identities)) fail('scope frame must be an array');
    const frame = identities.map(identity => {
      if (!isSemanticIdentity(identity)) fail('scope frame contains invalid identity');
      if (identity.kind === 'free-symbol') fail('free symbols cannot be lexical binders');
      return identity;
    });
    return new LexicalIdentityScope(this.#taskScopeId, [...this.#frames, Object.freeze(frame)]);
  }

  resolve(name) {
    nonEmptyString(name, 'name');

    for (let i = this.#frames.length - 1; i >= 0; i -= 1) {
      const frame = this.#frames[i];
      for (let j = frame.length - 1; j >= 0; j -= 1) {
        if (displayNameOf(frame[j]) === name) return frame[j];
      }
    }

    return freeSymbolIdentity(this.#taskScopeId, name);
  }
}

export { IDENTITY_VERSION };
