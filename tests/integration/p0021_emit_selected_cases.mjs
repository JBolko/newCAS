import { compileSelectedValueCall } from '../../src/js/semantics/compile-selected-value-call.js';
import { operationSpec } from '../../src/js/operations/operation-spec.js';
import { valueLiteral, providerReference, operationReference, call, define } from '../../src/js/semantics/semantic-ir.js';

const integer = n => Object.freeze({valueVersion:1,kind:'expression',data:Object.freeze({expr:Object.freeze({op:'integer',value:String(n)})})});
const spec = operationSpec({operationId:'add',evaluatorId:'probe.scalar.add',arguments:[{name:'lhs',role:'value'},{name:'rhs',role:'value'}]});
const envelope = (providers=[],source='b := 2+3')=>({protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'b',taskScopeId:'T',source,providers});
const expression = (left,right) => define('b',call(operationReference('add'),[left,right]));
const emit = (e,ir,operation=spec)=>({envelope:e,selection:compileSelectedValueCall(e,ir,operation)});
const literal = (a,b)=>emit(envelope(),expression(valueLiteral(integer(a)),valueLiteral(integer(b))));
const provider = n => ({name:'a',providerId:'writer-2',value:integer(n)});
const bound = n => emit(envelope([provider(n)],'b := a+3'),expression(providerReference('writer-2'),valueLiteral(integer(3))));
const cases = {
  literal_2_3: literal(2,3),
  literal_7_minus_2: literal(7,-2),
  exact_provider: bound(4),
  failing_provider_value: bound(0),
};
// The JS compiler MUST reject a mismatched provider identity before transport.
let rejectsWrongProvider = false;
try { emit(envelope([provider(4)]),expression(providerReference('writer-1'),valueLiteral(integer(3)))); }
catch(error) { rejectsWrongProvider = /provider identity/.test(String(error.message)); }
if (!rejectsWrongProvider) throw new Error('wrong provider identity was not rejected');
// The receiving Python side MUST reject tampering with the compiled identity attestation.
const tampered = structuredClone(cases.exact_provider);
tampered.selection.providerIds[0].providerId = 'writer-1';
cases.tampered_identity = tampered;
const tamperedEvaluator = structuredClone(cases.literal_2_3);
tamperedEvaluator.selection.evaluationRequest.evaluatorId = 'unexpected';
cases.tampered_evaluator = tamperedEvaluator;
process.stdout.write(JSON.stringify(cases));
