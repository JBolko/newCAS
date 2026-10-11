import test from 'node:test';
import assert from 'node:assert/strict';
import {expression, interval, unionSet, emptySet, negativeInfinityBound, positiveInfinityBound, encodeValue, decodeValue} from '../../src/js/values/value.js';
const n = number => expression({op:'integer',value:String(number)});
test('unbounded interval supports open minus infinity',()=>{
 const v=interval(negativeInfinityBound(),n(7),{upperClosed:true});
 assert.equal(decodeValue(encodeValue(v)).data.lower.bound,'negative-infinity');
 assert.equal(v.data.upperClosed,true);
});
test('unbounded interval rejects closed infinities and backwards markers',()=>{
 assert.throws(()=>interval(negativeInfinityBound(),n(7),{lowerClosed:true}));
 assert.throws(()=>interval(positiveInfinityBound(),n(7)));
 assert.throws(()=>interval(n(7),negativeInfinityBound()));
});
test('union canonicalization and roundtrip',()=>{
 const a=interval(negativeInfinityBound(),n(-2),{upperClosed:true});
 const b=interval(n(2),positiveInfinityBound(),{lowerClosed:true});
 const ab=unionSet([a,b]),ba=unionSet([b,a]);
 assert.equal(encodeValue(ab),encodeValue(ba));
 assert.deepEqual(decodeValue(encodeValue(ab)),ab);
});
test('union cannot mix non set values',()=>{
 assert.throws(()=>unionSet([emptySet(),n(1)]));
});
