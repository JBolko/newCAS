/** P0021 Slice 73: lower one P0020-attested document expression to Semantic IR.
 * This is COMPILATION ONLY: no evaluator, provider lookup, task state or fallback.
 * Repeated callable occurrences intentionally share the attested name/provider.
 */
import {isOperationSpec} from '../operations/operation-spec.js';
import {providerReference,operationReference,semanticReference,call,define} from './semantic-ir.js';
import {LexicalIdentityScope} from './identity.js';
import {matchesSelectedOperationSpec} from '../operations/selected-operation-catalog.js';
import {resolveSelectedOperationCall} from './resolve-selected-operation-call.js';
import {planSourceOccurrenceRoles} from './plan-source-occurrence-roles.js';
import {createSelectedArithmeticLowering} from './lower-selected-arithmetic.js';
import {lowerSourceExpressionTree} from './lower-source-expression-tree.js';
import {rejectLexicalCallable} from './reject-lexical-callable.js';

const fail = m => {throw new TypeError(`P0021 attested IR: ${m}`);};
export function compileAttestedDocumentExpressionIR(statement,{
  entry,blockId,specs,writers=[],taskScopeId=null,makeLocalId=null,
}={}) {
  if (!entry || !Array.isArray(entry.references) || !Array.isArray(entry.calls) ||
      !(specs instanceof Map) || typeof blockId!=='string' || !blockId) fail('attested entry, block identity and specs required');
  if (entry.parseError!==null && entry.parseError!==undefined) fail('invalid source');
  const localCall=entry.calls.find(item=>item.classification==='lexical-binder');
  if(localCall)rejectLexicalCallable(localCall.name);
  const reads = new Map(), callables = new Map(), selectedCalls = new Map();
  for(const ref of entry.references){
    if(ref.binding?.kind!=='provider-reference' || typeof ref.binding.providerId!=='string' || !ref.binding.providerId)fail('unresolved read');
    if(reads.has(ref.name) && reads.get(ref.name)!==ref.binding.providerId)fail('conflicting reads');
    reads.set(ref.name,ref.binding.providerId);
  }
  for(const item of entry.calls){
    if(typeof item?.name!=='string' || !item.name ||
        !Array.isArray(item.candidates) || item.candidates.length!==1)
      fail('unresolved callable');
    if(item.classification==='document-writer' && item.candidates[0]==='document-writer') {
      if(typeof item.providerId!=='string' || !item.providerId || selectedCalls.has(item.name))
        fail('invalid callable provider');
      if(callables.has(item.name) && callables.get(item.name)!==item.providerId)
        fail('conflicting calls');
      if(reads.has(item.name) && reads.get(item.name)!==item.providerId)
        fail('conflicting read/call');
      callables.set(item.name,item.providerId);
    } else if(item.classification==='operation' && item.candidates[0]==='operation') {
      // Only a P0020-classified, explicitly selected P0008 operation is eligible.
      // An ambiguous document writer collision never becomes a local binder.
      const selectedSpec=specs.get(item.name);
      if(item.providerId!==null || !matchesSelectedOperationSpec(selectedSpec) ||
          callables.has(item.name))
        fail('unattested selected operation');
      selectedCalls.set(item.name,selectedSpec);
    } else fail('unresolved callable');
  }
  const selected=(name,args)=>{
    const spec=specs.get(name);
    if(!isOperationSpec(spec) || spec.operationId!==name ||
        spec.arguments?.length!==args.length || spec.arguments.some(a=>a.role!=='value'))fail(`unsupported operation ${name}`);
    return call(operationReference(name),args);
  };
  // Same arithmetic rules as function-source compilation; attestation stays here.
  const arithmetic=createSelectedArithmeticLowering(selected);
  const seenCalls=new Set(), seenReads=new Set(), localIdentityIds=new Set();
  const supplyLocalId=meta=>{
    const id=makeLocalId(meta);
    if(typeof id!=='string' || !id || localIdentityIds.has(id))
      fail('duplicate or invalid document-owned local identity');
    localIdentityIds.add(id);
    return id;
  };
  // Lexical identities are enabled only by a caller-owned document scope and
  // identity supplier. Ordinary documents retain their existing IR byte shape.
  const lexicalScope=taskScopeId===null ? null : new LexicalIdentityScope(taskScopeId);
  const resolveVariable=(n,scope)=>{
    const identity=scope?.resolve(n.name);
    if(identity && identity.kind!=='free-symbol')return semanticReference(identity);
    if(!reads.has(n.name))fail(`unattested variable ${n.name}`);
    seenReads.add(n.name);return providerReference(reads.get(n.name));
  };
  const resolveCall=(n,scope,visit)=>{
    if(!Array.isArray(n.args))fail('invalid callable AST');
    if(scope!==null && scope.resolve(n.name).kind!=='free-symbol')rejectLexicalCallable(n.name);
    if(selectedCalls.has(n.name)) {
      if(scope===null || typeof makeLocalId!=='function')
        fail('selected symbolic operation requires document-owned identity supplier');
      const spec=selectedCalls.get(n.name);
      const plan=planSourceOccurrenceRoles(n,spec);
      if(plan.status!=='selected')fail('unselected operation signature');
      seenCalls.add(n.name);
      return resolveSelectedOperationCall(n,spec,
        (arg,meta)=>visit(arg,meta.lexicalScope??scope),supplyLocalId,scope);
    }
    if(!callables.has(n.name))fail(`unattested callable ${n.name}`);
    seenCalls.add(n.name);
    return call(providerReference(callables.get(n.name)),n.args.map(arg=>visit(arg,scope)));
  };
  const visit=n=>lowerSourceExpressionTree(n,{arithmetic,resolveVariable,resolveCall,
    reject:fail,context:lexicalScope});
  if(!statement || typeof statement!=='object')fail('statement required');
  let result;
  if(statement.type==='Assignment'){
    if(!Array.isArray(writers) || !writers.some(w=>w.writerId===blockId && w.name===statement.name))
      fail('unattested writer');
    result=define(blockId,visit(statement.value));
  } else result=visit(statement);
  if(seenCalls.size!==callables.size+selectedCalls.size || seenReads.size!==reads.size)fail('unconsumed attestations');
  return result;
}
