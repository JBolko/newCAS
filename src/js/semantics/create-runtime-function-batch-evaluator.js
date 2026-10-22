/** P0021 Slice 51 — compose existing source-attested definition and literal-call
 * evaluators for ONE ordered batch. The transient outcomes live only as long as
 * the invocation; DocumentRuntime alone commits authoritative calculation state.
 */
import {createSourceFunctionDefinitionTaskEvaluator} from './create-source-function-definition-task-evaluator.js';
import {isValue} from '../values/value.js';
import {createAttestedIRTaskEvaluator} from './create-attested-ir-task-evaluator.js';
import {evaluateSelectedFunctionApplication} from './evaluate-selected-function-application.js';
import {diagnostic} from '../diagnostics/diagnostic.js';

const fail = message => {throw new TypeError(`P0021 runtime function batch: ${message}`);};
export function createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate,revision,cachedOutcomes=new Map()}={}) {
  if (!snapshot || !Array.isArray(snapshot.blocks) || typeof parse!=='function' ||
      !(specs instanceof Map) || typeof evaluate!=='function' ||
      typeof revision!=='string' || !revision) fail('explicit snapshot, operations, backend and revision required');
  if (!(cachedOutcomes instanceof Map)) fail('cached outcomes must be an explicit Map');
  const entries = new Map(snapshot.blocks.map(b => [b.blockId,b]));
  if (entries.size !== snapshot.blocks.length) fail('duplicate document block identity');
  const known = new Map(); // current-batch outcomes plus explicit revision-valid providers
  for (const [id, record] of cachedOutcomes) {
    if (!entries.has(id) || record?.revision !== revision ||
        record.outcome?.blockId !== id || record.outcome.status !== 'success' ||
        !isValue(record.outcome.value)) fail('invalid or stale cached provider');
    known.set(id, record.outcome);
  }
  const read = id => known.get(id) ?? null;
  return async task => {
    if (!task || !entries.has(task.blockId) || task.taskScopeId!==snapshot.taskScopeId)
      fail('task outside analyzed document snapshot');
    const ast = parse(task.source);
    if (!Array.isArray(ast) || ast.length!==1) fail('single source statement required');
    let evaluator;
    if (ast[0].type==='FunctionDefinition') {
      evaluator=createSourceFunctionDefinitionTaskEvaluator({snapshot,blockId:task.blockId,
        expectedName:ast[0].name,parse,specs,getProviderOutcome:read,revision});
    } else if (['Assignment','FunctionCall','Variable','List','Literal','UnaryExpression','BinaryExpression','PowerExpression'].includes(ast[0].type)) {
      // Single resolved IR expression path for assignment values,
      // variable reads, simple calls and arbitrary nested calls.
      evaluator=createAttestedIRTaskEvaluator({snapshot,blockId:task.blockId,parse,specs,evaluate,
        applyFunction:evaluateSelectedFunctionApplication,getProviderOutcome:read,revision});
    } else if (ast[0].type==='Conversion' &&
        ['Assignment','FunctionDefinition'].includes(ast[0].expr?.type)) {
      // Parse acceptance does not enable statement conversion or establish a
      // nested writer. Report a local capability failure before any backend.
      const unsupported=diagnostic('unsupported-operation',{operationId:'conversion'});
      return Object.freeze({blockId:task.blockId,status:'failure',code:unsupported.code,
        message:unsupported.code,diagnostic:unsupported});
    } else fail('unsupported statement in selected runtime slice');
    const result=await evaluator(task);
    if (result?.blockId!==task.blockId || !['success','failure'].includes(result?.status))
      fail('invalid evaluation outcome');
    // Only successful outcomes are eligible as providers. Failed/blocked tasks
    // cannot be silently substituted by an older document result.
    if (result.status==='success') known.set(task.blockId,result);
    return result;
  };
}
