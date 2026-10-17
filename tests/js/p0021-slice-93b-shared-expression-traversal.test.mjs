/** S93b: one structural traversal; name, call and capability decisions remain owned. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {lowerSourceExpressionTree} from '../../src/js/semantics/lower-source-expression-tree.js';
import {createSelectedArithmeticLowering} from '../../src/js/semantics/lower-selected-arithmetic.js';
import {compileSelectedSourceAst} from '../../src/js/semantics/compile-selected-source-ast.js';
import {compileAttestedDocumentExpressionIR} from '../../src/js/semantics/compile-attested-document-expression-ir.js';
import {compileSelectedFunctionDefinition} from '../../src/js/semantics/compile-selected-function-definition.js';
import {providerReference, operationReference, call, isSemanticIRNode} from '../../src/js/semantics/semantic-ir.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';

const literal = value => ({type:'Literal',value});
const variable = name => ({type:'Variable',name});
const binary = (op,left,right) => ({type:'BinaryExpression',op,left,right});
const functionCall = (name,...args) => ({type:'FunctionCall',name,args});
const spec = name => operationSpec({operationId:name,evaluatorId:`s93b.${name}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]});
const specs = new Map(['add','multiply','power'].map(name=>[name,spec(name)]));
const visitKinds = node => [node.kind,...(node.kind==='call'?node.args.flatMap(visitKinds):[])];

test('S93b: structural walker has no implicit name lookup or operation selection',()=>{
  const ast=functionCall('f',binary('+',variable('x'),literal(2)));
  assert.throws(()=>lowerSourceExpressionTree(ast),/explicit arithmetic and resolution callbacks/);
  const seen=[];
  const arithmetic=createSelectedArithmeticLowering((name,args)=>{
    seen.push(`operation:${name}`);
    return call(operationReference(name),args);
  });
  const ir=lowerSourceExpressionTree(ast,{
    arithmetic,
    resolveVariable(node){seen.push(`variable:${node.name}`);return providerReference('attested-x');},
    resolveCall(node,_context,visit){seen.push(`call:${node.name}`);return call(providerReference('attested-f'),node.args.map(arg=>visit(arg)));},
    reject(message){throw new TypeError(message);}
  });
  assert.deepEqual(seen,['call:f','variable:x','operation:add']);
  assert.equal(isSemanticIRNode(ir),true);
  assert.equal(ir.callee.providerId,'attested-f');
  assert.equal(ir.args[0].args[0].providerId,'attested-x');
  assert.equal(Object.isFrozen(ir),true);
});

test('S93b: attested document callable is never an implicitly selected operation',()=>{
  const ast=functionCall('f',binary('+',variable('a'),literal(2)));
  const entry={parseError:null,
    references:[{name:'a',binding:{kind:'provider-reference',providerId:'p-a'}}],
    calls:[{name:'f',classification:'document-writer',candidates:['document-writer'],providerId:'p-f'}]};
  const ir=compileAttestedDocumentExpressionIR(ast,{entry,blockId:'use',specs});
  assert.equal(ir.callee.kind,'provider-reference');
  assert.equal(ir.callee.providerId,'p-f');
  assert.deepEqual(visitKinds(ir),['call','call','provider-reference','value']);
  assert.throws(()=>compileSelectedSourceAst(ast,{
    specs,resolveVariable:()=>providerReference('p-a'),
  }),/unselected operation f/);
  assert.throws(()=>compileAttestedDocumentExpressionIR(ast,{
    entry:{...entry,calls:[]},blockId:'use',specs,
  }),/unattested callable f/);
});

test('S93b: lexical function binder shadows document variable without changing identity',()=>{
  const ir=compileSelectedFunctionDefinition({type:'FunctionDefinition',name:'f',params:['x'],
    body:binary('+',variable('x'),variable('a'))},{
    writerId:'f-def',taskScopeId:'task1',specs,
    makeBinderId:({writerId,index})=>`${writerId}:${index}`,
    resolveVariable:name=>{assert.equal(name,'a');return providerReference('provider-a');}
  });
  assert.equal(ir.kind,'define-function');
  assert.equal(ir.body.args[0].kind,'semantic-reference');
  assert.equal(ir.body.args[0].identity.kind,'binder');
  assert.equal(ir.body.args[1].kind,'provider-reference');
  assert.equal(ir.body.args[1].providerId,'provider-a');
});

test('S93b: unsupported nodes fail closed; unknown unary operator never resolves child',()=>{
  let touched=false;
  const base={
    arithmetic:createSelectedArithmeticLowering((op,args)=>call(operationReference(op),args)),
    resolveVariable:()=>{touched=true;return providerReference('p');},
    resolveCall:()=>{touched=true;return providerReference('f');},
    reject:message=>{throw new TypeError(message);},
  };
  assert.throws(()=>lowerSourceExpressionTree({type:'UnaryExpression',op:'!',argument:variable('x')},base),/unsupported unary/);
  assert.equal(touched,false);
  assert.throws(()=>lowerSourceExpressionTree({type:'ExecutePython',code:'pass'},base),/unsupported node type/);
  assert.throws(()=>lowerSourceExpressionTree([literal(1)],base),/invalid expression node/);
  assert.equal(touched,false);
});

test('S93b: compound arithmetic retains one structural lowering contract',()=>{
  const ast=binary('*',binary('-',variable('a'),literal(2)),
    {type:'PowerExpression',base:variable('b'),exponent:literal(3)});
  const selected=compileSelectedSourceAst(ast,{specs,resolveVariable:name=>providerReference(`p-${name}`)});
  const attested=compileAttestedDocumentExpressionIR(ast,{entry:{parseError:null,calls:[],
    references:['a','b'].map(name=>({name,binding:{kind:'provider-reference',providerId:`p-${name}`}}))},
    blockId:'out',specs});
  assert.deepEqual(selected,attested);
  assert.equal(Object.isFrozen(selected),true);
});
