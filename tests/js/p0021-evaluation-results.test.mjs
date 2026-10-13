import test from 'node:test';
import assert from 'node:assert/strict';
import {beginSemanticEvaluationResults as begin, nextSemanticEvaluationDecision as next, commitSemanticEvaluationOutcome as commit} from '../../src/js/semantics/commit-semantic-evaluation-results.js';
const batch = () => ({tasks:[{blockId:'a',upstream:[]},{blockId:'b',upstream:['a']},{blockId:'c',upstream:['b']}],cycles:[],blocked:[]});
const success=(blockId,n)=>({blockId,status:'success',value:{kind:'number',n}});
const failure=(blockId,code='EVAL_ERROR')=>({blockId,status:'failure',code,message:'failed'});
test('s5: ordered success outcomes and completed batch',()=>{const b=batch();let s=begin(b,'r1');assert.equal(next(b,s,'r1').kind,'evaluate');for(let i=0;i<3;i++)s=commit(b,s,'r1',success('abc'[i],i));assert.equal(next(b,s,'r1').kind,'complete');assert.deepEqual(s.outcomes.map(x=>x.blockId),['a','b','c']);});
test('s5: stale evaluation cannot commit after source changes',()=>{const b=batch(),s=begin(b,'r1');assert.equal(next(b,s,'r2').kind,'stale');assert.throws(()=>commit(b,s,'r2',success('a',1)),/stale/);});
test('s5: failure is preserved, downstream must be blocked',()=>{const b=batch();let s=commit(b,begin(b,'r1'),'r1',failure('a'));assert.deepEqual({...next(b,s,'r1')},{kind:'blocked',blockId:'b',providerId:'a'});assert.throws(()=>commit(b,s,'r1',success('b',2)),/blocked/);s=commit(b,s,'r1',failure('b','UPSTREAM_FAILED'));assert.equal(next(b,s,'r1').kind,'blocked');});
test('s5: upstream failures never trigger fallback',()=>{const b=batch();let s=commit(b,begin(b,'r1'),'r1',failure('a'));assert.equal(next(b,s,'r1').providerId,'a');});
test('s5: out-of-order and invalid outcome rejected',()=>{const b=batch(),s=begin(b,'r1');assert.throws(()=>commit(b,s,'r1',success('b',2)),/out-of-order/);assert.throws(()=>commit(b,s,'r1',{blockId:'a',status:'success'}),/invalid/);});
test('s5: result values are immutable snapshots detached from caller',()=>{const b=batch();const v=success('a',1);const s=commit(b,begin(b,'r1'),'r1',v);v.value.n=999;assert.equal(s.outcomes[0].value.n,1);assert.ok(Object.isFrozen(s.outcomes[0].value));});
test('s5: nonportable Python/JS objects cannot cross boundary',()=>{const b=batch(),s=begin(b,'r1');for(const v of [new Map(),()=>2,{n:Infinity},{n:undefined}])assert.throws(()=>commit(b,s,'r1',{blockId:'a',status:'success',value:v}),/invalid/);});
test('s5: missing cache is not silently considered available',()=>{const b={tasks:[{blockId:'b',upstream:['a']}],cycles:[],blocked:[]};const s=begin(b,'r1');assert.deepEqual({...next(b,s,'r1')},{kind:'missing-upstream',blockId:'b',providerId:'a'});});
test('s5: valid cached prerequisite permits partial recomputation',()=>{const b={tasks:[{blockId:'b',upstream:['a']}],cycles:[],blocked:[]};const s=begin(b,'r1');const cache=new Map([['a',{revision:'r1',outcome:success('a',3)}]]);assert.equal(next(b,s,'r1',cache).kind,'evaluate');assert.equal(commit(b,s,'r1',success('b',6),cache).cursor,1);});
test('s5: invalid cached result cannot silently satisfy upstream',()=>{const b={tasks:[{blockId:'b',upstream:['a']}],cycles:[],blocked:[]};const s=begin(b,'r1');assert.equal(next(b,s,'r1',new Map([['a',{revision:'r1',outcome:{status:'success'}}]])).kind,'missing-upstream');});
test('s5: state belongs to original batch order',()=>{const b=batch(),s=begin(b,'r1');const modified=batch();modified.tasks.reverse();assert.throws(()=>next(modified,s,'r1'),/does not match/);});

test('s5: result from old revision is never reused',()=>{const b={tasks:[{blockId:'b',upstream:['a']}],cycles:[],blocked:[]};const s=begin(b,'r2');const cache=new Map([['a',{revision:'r1',outcome:success('a',3)}]]);assert.equal(next(b,s,'r2',cache).kind,'missing-upstream');});
