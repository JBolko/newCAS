export const DIAGNOSTIC_VERSION = 1;
export const DIAGNOSTIC_SPEC_VERSION = 1;
function fail(m){throw new TypeError(`Diagnostic: ${m}`)}
function str(v,l){if(typeof v!=='string'||!v.length)fail(`${l} must be a non-empty string`);return v}
function plain(v){if(v===null||typeof v!=='object'||Array.isArray(v))return false;let p=Object.getPrototypeOf(v);return p===Object.prototype||p===null}
function transport(v,p='parameters'){
 if(v===null||typeof v==='string'||typeof v==='boolean')return v;
 if(typeof v==='number'){if(!Number.isFinite(v))fail(`${p} must contain only finite numbers`);return v}
 if(Array.isArray(v))return Object.freeze(v.map((x,i)=>transport(x,`${p}[${i}]`)));
 if(plain(v)){let c={};for(let [k,x] of Object.entries(v))c[k]=transport(x,`${p}.${k}`);return Object.freeze(c)}
 fail(`${p} must contain only transport-safe primitives, arrays, and plain objects`)
}
export function diagnostic(code,parameters={}){
 str(code,'code');if(!plain(parameters))fail('parameters must be a plain object');
 return Object.freeze({diagnosticVersion:DIAGNOSTIC_VERSION,code,parameters:transport(parameters)})
}
export function isDiagnostic(v){
 if(!v||typeof v!=='object'||!Object.isFrozen(v)||v.diagnosticVersion!==DIAGNOSTIC_VERSION||typeof v.code!=='string'||!v.code.length||!plain(v.parameters)||!Object.isFrozen(v.parameters))return false;
 try{transport(v.parameters);return true}catch{return false}
}
const TYPES=new Set(['string','string-list','non-negative-integer','non-negative-integer-list','transport']);
function descriptor(d,label){
 let type,required=true;
 if(typeof d==='string')type=d;
 else if(plain(d)){
  for(let k of Object.keys(d))if(k!=='type'&&k!=='required')fail(`${label} has unexpected descriptor property "${k}"`);
  type=d.type;
  if(Object.hasOwn(d,'required')){if(typeof d.required!=='boolean')fail(`${label}.required must be boolean`);required=d.required}
 }else fail(`${label} must be a parameter type or descriptor object`);
 if(!TYPES.has(type))fail(`${label} has unsupported parameter type`);
 return Object.freeze({type,required})
}
export function diagnosticSpec({code,parameters}){
 str(code,'spec code');if(!plain(parameters))fail('spec parameters must be a plain object');
 let p={};for(let [n,d] of Object.entries(parameters)){str(n,'parameter name');p[n]=descriptor(d,`parameter "${n}"`)}
 return Object.freeze({diagnosticSpecVersion:DIAGNOSTIC_SPEC_VERSION,code,parameters:Object.freeze(p)})
}
export function isDiagnosticSpec(v){
 if(!v||typeof v!=='object'||!Object.isFrozen(v)||v.diagnosticSpecVersion!==DIAGNOSTIC_SPEC_VERSION||typeof v.code!=='string'||!v.code.length||!plain(v.parameters)||!Object.isFrozen(v.parameters))return false;
 for(let [n,d] of Object.entries(v.parameters))if(!n.length||!plain(d)||!Object.isFrozen(d)||!TYPES.has(d.type)||typeof d.required!=='boolean'||Object.keys(d).length!==2)return false;
 return true
}
function check(t,v,n){
 if(t==='string'){str(v,n);return}
 if(t==='string-list'){if(!Array.isArray(v)||!v.length||v.some(x=>typeof x!=='string'||!x.length))fail(`${n} must be a non-empty list of non-empty strings`);return}
 if(t==='non-negative-integer'){if(!Number.isInteger(v)||v<0)fail(`${n} must be a non-negative integer`);return}
 if(t==='non-negative-integer-list'){if(!Array.isArray(v)||!v.length||v.some(x=>!Number.isInteger(x)||x<0))fail(`${n} must be a non-empty list of non-negative integers`);return}
 if(t==='transport'){transport(v,n);return}
 fail(`${n} has unsupported parameter type`)
}
export function diagnosticFromSpec(spec,parameters){
 if(!isDiagnosticSpec(spec))fail('spec must be a DiagnosticSpec');if(!plain(parameters))fail('parameters must be a plain object');
 for(let [n,d] of Object.entries(spec.parameters))if(d.required&&!Object.hasOwn(parameters,n))fail(`${spec.code} requires parameter "${n}"`);
 for(let n of Object.keys(parameters))if(!Object.hasOwn(spec.parameters,n))fail(`${spec.code} received unexpected parameter "${n}"`);
 for(let [n,v] of Object.entries(parameters))check(spec.parameters[n].type,v,n);
 return diagnostic(spec.code,parameters)
}

// Accepted P0005 v2 codec producers; no mathematical/statistical diagnostics.
export const VALUE_CODEC_DIAGNOSTIC_SPECS = Object.freeze({
 'unsupported-value-encoding': diagnosticSpec({code:'unsupported-value-encoding',parameters:{path:'string',feature:'string',actual:'string',supported:'string-list'}}),
 'invalid-value-encoding': diagnosticSpec({code:'invalid-value-encoding',parameters:{path:'string',reason:'string'}}),
 'value-codec-resource-limit': diagnosticSpec({code:'value-codec-resource-limit',parameters:{path:'string',resource:'string',limit:'non-negative-integer'}}),
});
const CODEC_ENUMS = Object.freeze({
 feature: new Set(['value-version','value-kind','statistics-variant']),
 reason: new Set(['json-syntax','record-shape','field-set','version-shape','leaf-shape','variant-shape','nesting-version','mutable-value','non-json-data']),
 resource: new Set(['depth','nodes','encoded-bytes']),
});
export function valueCodecDiagnostic(code, parameters) {
 const spec=VALUE_CODEC_DIAGNOSTIC_SPECS[code];
 if(!spec)fail('unknown Value codec producer');
 for(const [name,allowed] of Object.entries(CODEC_ENUMS)) {
  if(Object.hasOwn(parameters,name)&&!allowed.has(parameters[name]))fail(`invalid codec ${name}`);
 }
 return diagnosticFromSpec(spec,parameters);
}
