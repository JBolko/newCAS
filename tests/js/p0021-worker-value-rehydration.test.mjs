import test from 'node:test';
import assert from 'node:assert/strict';
import {binderIdentity} from '../../src/js/semantics/identity.js';
import {expression,decodeValue,isValue,functionValue} from '../../src/js/values/value.js';
import {materializeSelectedDerivativeFunction} from '../../src/js/semantics/materialize-selected-derivative-function.js';
import {readFileSync} from 'node:fs';

const binder=binderIdentity('p0021:worker:lexical-x','x');
const sym={op:'symbolRef',identity:binder};
const num=value=>({op:'integer',value:String(value)});
const fn=functionValue([{identity:binder}],expression(sym),[]);
const derivative=expression({op:'add',args:[sym,num(4)]});

test('S37 repair: JSON Worker roundtrip drops frozen identity; P0005 decoder restores it',()=>{
 const wire=JSON.parse(JSON.stringify(derivative));
 assert.equal(wire.kind,'expression');
 assert.equal(Object.isFrozen(wire.data.expr.args[0].identity),false);
 assert.equal(isValue(wire),false);
 assert.throws(()=>materializeSelectedDerivativeFunction({fn,derivative:wire,targetIdentity:binder}),/ExpressionValue required/);
 const restored=decodeValue(JSON.stringify(wire));
 assert.equal(isValue(restored),true);
 assert.equal(Object.isFrozen(restored.data.expr.args[0].identity),true);
 const result=materializeSelectedDerivativeFunction({fn,derivative:restored,targetIdentity:binder});
 assert.equal(result.kind,'function');
 assert.equal(Object.isFrozen(result),true);
});

test('S37 repair: browser normalizes actual Worker response through strict P0005 decoder',()=>{
 const source=readFileSync(new URL('../browser/p0021-derived-function-worker-smoke.mjs',import.meta.url),'utf8');
 assert.match(source,/const derivative=response\.value/);
 assert.match(source,/materializeSelectedDerivativeFunction\(\{fn,derivative,targetIdentity:identity\}\)/);
 assert.match(source,/slice38-shared-worker-value-v1/);
 assert.doesNotMatch(source,/derivative:response\.value/);
});
