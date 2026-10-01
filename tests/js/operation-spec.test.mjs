import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARGUMENT_ROLE,
  OPERATION_PURITY,
  isOperationSpec,
  operationSpec,
} from '../../src/js/operations/operation-spec.js';

const roles = (args) => args.map(({ name, role }) => [name, role]);

const catalog = Object.freeze({
  sin: operationSpec({
    operationId: 'sin',
    evaluatorId: 'sin',
    arguments: [{ name: 'operand', role: ARGUMENT_ROLE.VALUE }],
  }),

  diff: operationSpec({
    operationId: 'diff',
    evaluatorId: 'differentiate',
    arguments: [
      { name: 'expression', role: ARGUMENT_ROLE.VALUE },
      { name: 'variable', role: ARGUMENT_ROLE.SYMBOLIC },
    ],
  }),

  solve: operationSpec({
    operationId: 'solve',
    evaluatorId: 'solve',
    arguments: [
      { name: 'equation', role: ARGUMENT_ROLE.VALUE },
      { name: 'unknown', role: ARGUMENT_ROLE.SYMBOLIC },
    ],
  }),

  integrate: operationSpec({
    operationId: 'integrate',
    evaluatorId: 'integrate',
    signatures: [
      {
        arguments: [
          { name: 'integrand', role: ARGUMENT_ROLE.VALUE },
          { name: 'variable', role: ARGUMENT_ROLE.SYMBOLIC },
        ],
      },
      {
        arguments: [
          { name: 'integrand', role: ARGUMENT_ROLE.VALUE },
          { name: 'variable', role: ARGUMENT_ROLE.SYMBOLIC },
          { name: 'lower', role: ARGUMENT_ROLE.VALUE },
          { name: 'upper', role: ARGUMENT_ROLE.VALUE },
        ],
      },
    ],
  }),

  substitute: operationSpec({
    operationId: 'substitute',
    evaluatorId: 'substitute',
    arguments: [
      { name: 'expression', role: ARGUMENT_ROLE.VALUE },
      { name: 'target', role: ARGUMENT_ROLE.SYMBOLIC },
      { name: 'replacement', role: ARGUMENT_ROLE.VALUE },
    ],
  }),

  min: operationSpec({
    operationId: 'min',
    evaluatorId: 'min',
    arguments: [
      { name: 'value', role: ARGUMENT_ROLE.VALUE, variadic: true },
    ],
  }),

  bindExample: operationSpec({
    operationId: 'bind-example',
    evaluatorId: 'bind-example',
    arguments: [
      { name: 'binder', role: ARGUMENT_ROLE.SCOPED, scopeOver: ['body'] },
      { name: 'body', role: ARGUMENT_ROLE.VALUE },
    ],
  }),
});

function acceptsArity(signature, count) {
  const args = signature.arguments;
  if (args.length === 0) return count === 0;
  const last = args.at(-1);
  return last.variadic === true ? count >= args.length : count === args.length;
}

function selectSignature(spec, count) {
  const matches = spec.signatures.filter((signature) => acceptsArity(signature, count));
  if (matches.length !== 1) {
    throw new Error(`expected exactly one signature for ${spec.operationId}/${count}`);
  }
  return matches[0];
}

function resolutionPlan(spec, count) {
  const signature = selectSignature(spec, count);
  const plan = [];

  for (let i = 0; i < count; i += 1) {
    const declared = signature.arguments[Math.min(i, signature.arguments.length - 1)];
    plan.push({
      position: i,
      declaredName: declared.name,
      role: declared.role,
      scopeOver: declared.scopeOver ?? [],
      evaluatorId: spec.evaluatorId,
    });
  }

  return plan;
}

test('ordinary operation arguments can be declared as Value roles', () => {
  const spec=operationSpec({operationId:'sin',evaluatorId:'sin',arguments:[{name:'operand',role:ARGUMENT_ROLE.VALUE}]});
  assert.equal(spec.arguments[0].role,'value'); assert.equal(spec.purity,'pure'); assert.equal(isOperationSpec(spec),true);
});
test('symbolic argument role is distinct from ordinary Value role', () => {
  const spec=operationSpec({operationId:'diff',evaluatorId:'differentiate',arguments:[
    {name:'expression',role:ARGUMENT_ROLE.VALUE},{name:'variable',role:ARGUMENT_ROLE.SYMBOLIC}]});
  assert.deepEqual(roles(spec.arguments),[['expression','value'],['variable','symbolic']]);
});
test('scoped argument explicitly declares where its identity is visible', () => {
  const spec=operationSpec({operationId:'bind',evaluatorId:'bind',arguments:[
    {name:'binder',role:ARGUMENT_ROLE.SCOPED,scopeOver:['body']},{name:'body',role:ARGUMENT_ROLE.VALUE},{name:'outside',role:ARGUMENT_ROLE.VALUE}]});
  assert.deepEqual(spec.arguments[0].scopeOver,['body']);
});
test('evaluator dispatch identity is separate from public operation identity', () => {
  const spec=operationSpec({operationId:'diff',evaluatorId:'differentiate'});
  assert.equal(spec.operationId,'diff'); assert.equal(spec.evaluatorId,'differentiate');
});
test('purity and diagnostic adaptation are metadata', () => {
  const spec=operationSpec({operationId:'random',evaluatorId:'random',purity:OPERATION_PURITY.VOLATILE,diagnosticAdapterId:'random-diagnostics'});
  assert.equal(spec.purity,'volatile'); assert.equal(spec.diagnosticAdapterId,'random-diagnostics');
});
test('OperationSpec is deeply immutable and detached from caller containers', () => {
  const scopeOver=['body']; const args=[{name:'binder',role:ARGUMENT_ROLE.SCOPED,scopeOver},{name:'body',role:ARGUMENT_ROLE.VALUE}];
  const spec=operationSpec({operationId:'bind',evaluatorId:'bind',arguments:args});
  scopeOver.push('later'); args.push({name:'later',role:ARGUMENT_ROLE.VALUE}); args[0].name='mutated';
  assert.deepEqual(spec.arguments[0].scopeOver,['body']); assert.equal(spec.arguments[0].name,'binder');
  assert.equal(Object.isFrozen(spec.signatures),true); assert.equal(Object.isFrozen(spec.arguments),true);
});
test('OperationSpec rejects unknown roles and purity', () => {
  assert.throws(()=>operationSpec({operationId:'bad',evaluatorId:'bad',arguments:[{name:'x',role:'magic'}]}),/unknown argument role/);
  assert.throws(()=>operationSpec({operationId:'bad',evaluatorId:'bad',purity:'sometimes'}),/unknown purity/);
});
test('OperationSpec rejects accidental extra argument-policy fields', () => {
  assert.throws(()=>operationSpec({operationId:'bad',evaluatorId:'bad',arguments:[{name:'x',role:ARGUMENT_ROLE.VALUE,resolveLike:'legacy'}]}),/exactly/);
});
test('diff declares expression Value and symbolic differentiation variable', () => {
  const spec=operationSpec({operationId:'diff',evaluatorId:'differentiate',arguments:[
    {name:'expression',role:ARGUMENT_ROLE.VALUE},{name:'variable',role:ARGUMENT_ROLE.SYMBOLIC}]});
  assert.deepEqual(roles(spec.arguments),[['expression','value'],['variable','symbolic']]);
});
test('integrate distinguishes integrand and symbolic variable', () => {
  const spec=operationSpec({operationId:'integrate',evaluatorId:'integrate',arguments:[
    {name:'integrand',role:ARGUMENT_ROLE.VALUE},{name:'variable',role:ARGUMENT_ROLE.SYMBOLIC}]});
  assert.deepEqual(roles(spec.arguments),[['integrand','value'],['variable','symbolic']]);
});
test('solve distinguishes equation and symbolic unknown', () => {
  const spec=operationSpec({operationId:'solve',evaluatorId:'solve',arguments:[
    {name:'equation',role:ARGUMENT_ROLE.VALUE},{name:'unknown',role:ARGUMENT_ROLE.SYMBOLIC}]});
  assert.deepEqual(roles(spec.arguments),[['equation','value'],['unknown','symbolic']]);
});
test('substitution target is symbolic while replacement is Value', () => {
  const spec=operationSpec({operationId:'substitute',evaluatorId:'substitute',arguments:[
    {name:'expression',role:ARGUMENT_ROLE.VALUE},{name:'target',role:ARGUMENT_ROLE.SYMBOLIC},{name:'replacement',role:ARGUMENT_ROLE.VALUE}]});
  assert.deepEqual(roles(spec.arguments),[['expression','value'],['target','symbolic'],['replacement','value']]);
});
test('symbolic role does not encode lookup behavior', () => {
  const spec=operationSpec({operationId:'diff',evaluatorId:'differentiate',arguments:[
    {name:'expression',role:ARGUMENT_ROLE.VALUE},{name:'variable',role:ARGUMENT_ROLE.SYMBOLIC}]});
  assert.equal('nameResolution' in spec.arguments[1],false); assert.equal('documentLookup' in spec.arguments[1],false);
});
test('roles coexist without evaluator behavior', () => {
  const spec=operationSpec({operationId:'mixed',evaluatorId:'mixed',arguments:[
    {name:'left',role:ARGUMENT_ROLE.VALUE},{name:'target',role:ARGUMENT_ROLE.SYMBOLIC},{name:'right',role:ARGUMENT_ROLE.VALUE}]});
  assert.equal('evaluate' in spec,false); assert.equal('resolve' in spec,false);
});
test('scoped role expresses governed body arguments', () => {
  const spec=operationSpec({operationId:'bind',evaluatorId:'bind',arguments:[
    {name:'binder',role:ARGUMENT_ROLE.SCOPED,scopeOver:['body']},{name:'body',role:ARGUMENT_ROLE.VALUE},{name:'outside',role:ARGUMENT_ROLE.VALUE}]});
  assert.deepEqual(spec.arguments[0].scopeOver,['body']);
});
test('two scoped binders express nested scope without positional guessing', () => {
  const spec=operationSpec({operationId:'nested',evaluatorId:'nested',arguments:[
    {name:'outer',role:ARGUMENT_ROLE.SCOPED,scopeOver:['inner','body']},{name:'inner',role:ARGUMENT_ROLE.SCOPED,scopeOver:['body']},{name:'body',role:ARGUMENT_ROLE.VALUE}]});
  assert.deepEqual(spec.arguments[0].scopeOver,['inner','body']); assert.deepEqual(spec.arguments[1].scopeOver,['body']);
});
test('scopeOver rejects unknown targets, self scope and duplicate targets', () => {
  assert.throws(()=>operationSpec({operationId:'x',evaluatorId:'x',arguments:[{name:'b',role:ARGUMENT_ROLE.SCOPED,scopeOver:['missing']},{name:'body',role:ARGUMENT_ROLE.VALUE}]}),/unknown scopeOver target/);
  assert.throws(()=>operationSpec({operationId:'x',evaluatorId:'x',arguments:[{name:'b',role:ARGUMENT_ROLE.SCOPED,scopeOver:['b']}]}),/cannot scope over itself/);
  assert.throws(()=>operationSpec({operationId:'x',evaluatorId:'x',arguments:[{name:'b',role:ARGUMENT_ROLE.SCOPED,scopeOver:['body','body']},{name:'body',role:ARGUMENT_ROLE.VALUE}]}),/duplicate scopeOver target/);
});
test('argument names are unique within a signature', () => {
  assert.throws(()=>operationSpec({operationId:'x',evaluatorId:'x',arguments:[{name:'x',role:ARGUMENT_ROLE.VALUE},{name:'x',role:ARGUMENT_ROLE.SYMBOLIC}]}),/duplicate argument name/);
});

test('fixed binary operation remains naturally expressible as one signature', () => {
  const spec=operationSpec({operationId:'atan2',evaluatorId:'atan2',arguments:[
    {name:'y',role:ARGUMENT_ROLE.VALUE},{name:'x',role:ARGUMENT_ROLE.VALUE}]});
  assert.equal(spec.signatures.length,1); assert.equal(spec.arguments,spec.signatures[0].arguments);
});
test('integrate can declare two complete semantic signatures', () => {
  const spec=operationSpec({operationId:'integrate',evaluatorId:'integrate',signatures:[
    {arguments:[{name:'integrand',role:ARGUMENT_ROLE.VALUE},{name:'variable',role:ARGUMENT_ROLE.SYMBOLIC}]},
    {arguments:[{name:'integrand',role:ARGUMENT_ROLE.VALUE},{name:'variable',role:ARGUMENT_ROLE.SYMBOLIC},{name:'lower',role:ARGUMENT_ROLE.VALUE},{name:'upper',role:ARGUMENT_ROLE.VALUE}]}
  ]});
  assert.equal(spec.signatures.length,2);
});
test('multiple signatures preserve roles independently', () => {
  const spec=operationSpec({operationId:'integrate',evaluatorId:'integrate',signatures:[
    {arguments:[{name:'integrand',role:ARGUMENT_ROLE.VALUE},{name:'variable',role:ARGUMENT_ROLE.SYMBOLIC}]},
    {arguments:[{name:'integrand',role:ARGUMENT_ROLE.VALUE},{name:'variable',role:ARGUMENT_ROLE.SYMBOLIC},{name:'lower',role:ARGUMENT_ROLE.VALUE},{name:'upper',role:ARGUMENT_ROLE.VALUE}]}
  ]});
  assert.deepEqual(spec.signatures[1].arguments.map(a=>a.role),['value','symbolic','value','value']);
  assert.equal('arguments' in spec,false);
});
test('variadic Value operation declares explicit final repeated argument', () => {
  const spec=operationSpec({operationId:'min',evaluatorId:'min',arguments:[
    {name:'value',role:ARGUMENT_ROLE.VALUE,variadic:true}]});
  assert.equal(spec.arguments[0].variadic,true); assert.equal(spec.arguments[0].role,'value');
});
test('variadic argument must be final and unique', () => {
  assert.throws(()=>operationSpec({operationId:'x',evaluatorId:'x',arguments:[
    {name:'xs',role:ARGUMENT_ROLE.VALUE,variadic:true},{name:'tail',role:ARGUMENT_ROLE.VALUE}]}),/final argument/);
  assert.throws(()=>operationSpec({operationId:'x',evaluatorId:'x',arguments:[
    {name:'a',role:ARGUMENT_ROLE.VALUE,variadic:true},{name:'b',role:ARGUMENT_ROLE.VALUE,variadic:true}]}),/at most one variadic/);
});
test('operation uses either shorthand arguments or explicit signatures, never both', () => {
  assert.throws(()=>operationSpec({operationId:'x',evaluatorId:'x',
    arguments:[{name:'x',role:ARGUMENT_ROLE.VALUE}],
    signatures:[{arguments:[{name:'x',role:ARGUMENT_ROLE.VALUE}]}]}),/either arguments or signatures/);
});
test('signatures are deeply immutable and detached', () => {
  const args=[{name:'x',role:ARGUMENT_ROLE.VALUE}]; const sigs=[{arguments:args}];
  const spec=operationSpec({operationId:'x',evaluatorId:'x',signatures:sigs});
  args[0].name='mutated'; args.push({name:'y',role:ARGUMENT_ROLE.VALUE}); sigs.push({arguments:[]});
  assert.equal(spec.signatures.length,1); assert.equal(spec.signatures[0].arguments.length,1);
  assert.equal(spec.signatures[0].arguments[0].name,'x'); assert.equal(isOperationSpec(spec),true);
});
test('signature objects reject extra policy fields', () => {
  assert.throws(()=>operationSpec({operationId:'x',evaluatorId:'x',signatures:[
    {arguments:[{name:'x',role:ARGUMENT_ROLE.VALUE}],parseLike:'legacy'}]}),/signature must contain exactly arguments/);
});

// P0008 exit-criterion tests (formerly Slice 4)
test('representative catalog is expressible entirely as OperationSpecs', () => {
  assert.deepEqual(Object.keys(catalog), [
    'sin', 'diff', 'solve', 'integrate', 'substitute', 'min', 'bindExample',
  ]);
});

test('generic consumer derives sin policy without operation-name branching', () => {
  assert.deepEqual(resolutionPlan(catalog.sin, 1).map(x => x.role), ['value']);
});

test('generic consumer derives diff symbolic target without operation-name branching', () => {
  assert.deepEqual(resolutionPlan(catalog.diff, 2).map(x => x.role), ['value', 'symbolic']);
});

test('generic consumer derives solve symbolic target without operation-name branching', () => {
  assert.deepEqual(resolutionPlan(catalog.solve, 2).map(x => x.role), ['value', 'symbolic']);
});

test('generic consumer selects unbounded integrate signature by arity', () => {
  assert.deepEqual(
    resolutionPlan(catalog.integrate, 2).map(x => x.role),
    ['value', 'symbolic'],
  );
});

test('bounded integrate treats both bounds as Values, including a symbolic upper expression', () => {
  const plan = resolutionPlan(catalog.integrate, 4);

  // This is the policy needed for e.g.
  // F(x) := integrate(f(x), x, 1, x) + 5
  // The final x is an ordinary Value expression, not another symbolic target.
  assert.deepEqual(
    plan.map(x => x.role),
    ['value', 'symbolic', 'value', 'value'],
  );
  assert.equal(plan[3].declaredName, 'upper');
});

test('generic consumer derives substitution policy without operation-name branching', () => {
  assert.deepEqual(
    resolutionPlan(catalog.substitute, 3).map(x => x.role),
    ['value', 'symbolic', 'value'],
  );
});

test('generic consumer expands variadic Value policy without operation-name branching', () => {
  assert.deepEqual(
    resolutionPlan(catalog.min, 4).map(x => x.role),
    ['value', 'value', 'value', 'value'],
  );
});

test('generic consumer can read explicit scoped relationship without operation-name branching', () => {
  const plan = resolutionPlan(catalog.bindExample, 2);
  assert.equal(plan[0].role, 'scoped');
  assert.deepEqual(plan[0].scopeOver, ['body']);
});

test('evaluator dispatch is available generically for every representative operation', () => {
  for (const spec of Object.values(catalog)) {
    assert.equal(typeof spec.evaluatorId, 'string');
    assert.ok(spec.evaluatorId.length > 0);
  }
});

test('representative catalog requires no embedded resolver or evaluator callbacks', () => {
  for (const spec of Object.values(catalog)) {
    assert.equal('resolve' in spec, false);
    assert.equal('evaluate' in spec, false);
    assert.equal('documentRuntimeHandler' in spec, false);
  }
});

test('generic arity selection rejects unsupported integrate arity without operation-specific code', () => {
  assert.throws(
    () => selectSignature(catalog.integrate, 3),
    /expected exactly one signature/,
  );
});

test('generic arity selection rejects too few arguments for variadic min', () => {
  assert.throws(
    () => selectSignature(catalog.min, 0),
    /expected exactly one signature/,
  );
});

test('diagnostic adaptation metadata is generically available without implementing P0009', () => {
  for (const spec of Object.values(catalog)) {
    assert.ok(spec.diagnosticAdapterId === null || typeof spec.diagnosticAdapterId === 'string');
  }
});

// P0008 final boundary-audit tests (formerly Slice 5)
test('pure is the default and remains declarative metadata only', () => {
  const spec = operationSpec({
    operationId: 'sin',
    evaluatorId: 'sin',
    arguments: [{ name: 'operand', role: ARGUMENT_ROLE.VALUE }],
  });

  assert.equal(spec.purity, OPERATION_PURITY.PURE);
  assert.equal('cache' in spec, false);
  assert.equal('invalidate' in spec, false);
});

test('volatile can be declared without embedding runtime invalidation behavior', () => {
  const spec = operationSpec({
    operationId: 'random',
    evaluatorId: 'random',
    arguments: [],
    purity: OPERATION_PURITY.VOLATILE,
  });

  assert.equal(spec.purity, OPERATION_PURITY.VOLATILE);
  assert.equal('dirty' in spec, false);
  assert.equal('generation' in spec, false);
  assert.equal('documentRuntimeHandler' in spec, false);
});

test('diagnostic adaptation is an opaque declarative identity', () => {
  const spec = operationSpec({
    operationId: 'convert',
    evaluatorId: 'convert-unit',
    arguments: [
      { name: 'quantity', role: ARGUMENT_ROLE.VALUE },
      { name: 'target', role: ARGUMENT_ROLE.VALUE },
    ],
    diagnosticAdapterId: 'unit-conversion-diagnostics',
  });

  assert.equal(spec.diagnosticAdapterId, 'unit-conversion-diagnostics');
  assert.equal(typeof spec.diagnosticAdapterId, 'string');
  assert.equal('diagnosticAdapter' in spec, false);
  assert.equal('adaptDiagnostic' in spec, false);
});

test('OperationSpec does not define P0009 diagnostic codes prematurely', () => {
  const spec = operationSpec({
    operationId: 'solve',
    evaluatorId: 'solve',
    arguments: [
      { name: 'equation', role: ARGUMENT_ROLE.VALUE },
      { name: 'unknown', role: ARGUMENT_ROLE.SYMBOLIC },
    ],
    diagnosticAdapterId: 'solve-diagnostics',
  });

  assert.equal('diagnosticCode' in spec, false);
  assert.equal('arityDiagnostic' in spec, false);
  assert.equal('typeDiagnostic' in spec, false);
});

test('scopeOver remains policy and does not allocate or carry semantic identities', () => {
  const spec = operationSpec({
    operationId: 'bind-example',
    evaluatorId: 'bind-example',
    arguments: [
      { name: 'binder', role: ARGUMENT_ROLE.SCOPED, scopeOver: ['body'] },
      { name: 'body', role: ARGUMENT_ROLE.VALUE },
    ],
  });

  assert.deepEqual(spec.arguments[0].scopeOver, ['body']);
  assert.equal('identity' in spec.arguments[0], false);
  assert.equal('binderId' in spec.arguments[0], false);
  assert.equal('operationLocalId' in spec.arguments[0], false);
});

test('integration metadata records roles but no integration-specific resolver behavior', () => {
  const spec = operationSpec({
    operationId: 'integrate',
    evaluatorId: 'integrate',
    signatures: [
      {
        arguments: [
          { name: 'integrand', role: ARGUMENT_ROLE.VALUE },
          { name: 'variable', role: ARGUMENT_ROLE.SYMBOLIC },
        ],
      },
      {
        arguments: [
          { name: 'integrand', role: ARGUMENT_ROLE.VALUE },
          { name: 'variable', role: ARGUMENT_ROLE.SYMBOLIC },
          { name: 'lower', role: ARGUMENT_ROLE.VALUE },
          { name: 'upper', role: ARGUMENT_ROLE.VALUE },
        ],
      },
    ],
  });

  assert.deepEqual(
    spec.signatures[1].arguments.map(argument => argument.role),
    ['value', 'symbolic', 'value', 'value'],
  );
  assert.equal('resolveIntegrationVariable' in spec, false);
  assert.equal('resolveBounds' in spec, false);
  assert.equal('evaluateIntegral' in spec, false);
});

test('dispatch metadata does not carry evaluator implementation callbacks', () => {
  const spec = operationSpec({
    operationId: 'diff',
    evaluatorId: 'differentiate',
    arguments: [
      { name: 'expression', role: ARGUMENT_ROLE.VALUE },
      { name: 'variable', role: ARGUMENT_ROLE.SYMBOLIC },
    ],
  });

  assert.equal(spec.evaluatorId, 'differentiate');
  assert.equal(typeof spec.evaluatorId, 'string');
  assert.equal('evaluator' in spec, false);
  assert.equal('execute' in spec, false);
});

test('P0008 metadata remains independent of document state', () => {
  const spec = operationSpec({
    operationId: 'substitute',
    evaluatorId: 'substitute',
    arguments: [
      { name: 'expression', role: ARGUMENT_ROLE.VALUE },
      { name: 'target', role: ARGUMENT_ROLE.SYMBOLIC },
      { name: 'replacement', role: ARGUMENT_ROLE.VALUE },
    ],
  });

  for (const forbidden of [
    'taskId',
    'blockId',
    'documentOrder',
    'dependencyGraph',
    'dirty',
    'history',
    'providerId',
  ]) {
    assert.equal(forbidden in spec, false, forbidden);
  }
});
