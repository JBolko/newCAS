import { isSemanticIdentity } from './identity.js';
export const SEMANTIC_IR_VERSION = 1;
function fail(m){throw new TypeError(`SemanticIR: ${m}`)}
function str(v,l){if(typeof v!=='string'||!v.length)fail(`${l} must be a non-empty string`);return v}
function freeze(v){if(Array.isArray(v))return Object.freeze(v.map(freeze));if(v&&typeof v==='object'){const c={};for(const [k,x] of Object.entries(v))c[k]=freeze(x);return Object.freeze(c)}return v}
function node(kind,data){return freeze({irVersion:SEMANTIC_IR_VERSION,kind,...data})}
export function isSemanticIRNode(v){return !!(v&&typeof v==='object'&&Object.isFrozen(v)&&v.irVersion===SEMANTIC_IR_VERSION&&typeof v.kind==='string')}
export function valueLiteral(value){if(!value||typeof value!=='object'||!Object.isFrozen(value))fail('value literal requires an immutable Value');return node('value',{value})}
export function semanticReference(identity){if(!isSemanticIdentity(identity))fail('reference requires a SemanticIdentity');return node('semantic-reference',{identity})}
export function providerReference(providerId){return node('provider-reference',{providerId:str(providerId,'providerId')})}
export function operationReference(operationId){return node('operation-reference',{operationId:str(operationId,'operationId')})}
export function call(callee,args=[]){if(!isSemanticIRNode(callee))fail('call callee must be a SemanticIR node');if(!Array.isArray(args)||args.some(a=>!isSemanticIRNode(a)))fail('call args must be SemanticIR nodes');return node('call',{callee,args})}
export function define(writerId,body){if(!isSemanticIRNode(body))fail('define body must be a SemanticIR node');return node('define',{writerId:str(writerId,'writerId'),body})}
export function defineFunction(writerId,parameters,body){if(!Array.isArray(parameters)||!parameters.length||parameters.some(x=>!isSemanticIdentity(x)||x.kind!=='binder'))fail('function parameters must be binder SemanticIdentities');if(!isSemanticIRNode(body))fail('function body must be a SemanticIR node');return node('define-function',{writerId:str(writerId,'writerId'),parameters,body})}
