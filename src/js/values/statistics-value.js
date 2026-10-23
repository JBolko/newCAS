/** P0005 Value v2 structural codec. No document/backend/mathematical authority. */
import {valueCodecDiagnostic} from '../diagnostics/diagnostic.js';

export const VALUE_V2_LIMITS = Object.freeze({depth:128,nodes:100000,'encoded-bytes':8*1024*1024});
const ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const VERSIONED_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*\/v[1-9][0-9]*$/;
const pointer = (path,key) => `${path}/${String(key).replaceAll('~','~0').replaceAll('/','~1')}`;
const pathOf = path => path || '/';

function codecError(code, parameters) {
  // Keep the existing public unsupported-version wording as well as the new
  // structured facts; no caller needs to parse this presentation text.
  const message=code==='unsupported-value-encoding'&&parameters.feature==='value-version'
    ? `unsupported valueVersion ${parameters.actual}` : code;
  const error=new TypeError(`Invalid Value: ${message}`);
  Object.defineProperty(error,'diagnostic',{value:valueCodecDiagnostic(code,parameters)});
  throw error;
}
function invalid(path,reason='leaf-shape') {
  codecError('invalid-value-encoding',{path:pathOf(path),reason});
}
function unsupported(path,feature,actual,supported) {
  codecError('unsupported-value-encoding',{path:pathOf(path),feature,actual:String(actual),supported});
}
function resource(path,kind) {
  codecError('value-codec-resource-limit',{path:pathOf(path),resource:kind,limit:VALUE_V2_LIMITS[kind]});
}

// Allocation-free canonical JSON string byte count, including lone surrogates.
function stringBytes(text, available, path) {
  if(text.length+2>available)resource(path,'encoded-bytes');
  let bytes=2;
  for(let i=0;i<text.length;i++) {
    const c=text.charCodeAt(i);
    if(c===34||c===92)bytes+=2;
    else if(c<32)bytes+=([8,9,10,12,13].includes(c)?2:6);
    else if(c<128)bytes++;
    else if(c<2048)bytes+=2;
    else if(c>=0xd800&&c<=0xdbff) {
      const next=text.charCodeAt(i+1);
      if(next>=0xdc00&&next<=0xdfff){bytes+=4;i++;}else bytes+=6;
    } else bytes+=(c>=0xdc00&&c<=0xdfff?6:3);
    if(bytes>available)resource(path,'encoded-bytes');
  }
  return bytes;
}

function budget() {
  let nodes=0,bytes=0;
  return {
    node(depth,path){if(depth>VALUE_V2_LIMITS.depth)resource(path,'depth');if(++nodes>VALUE_V2_LIMITS.nodes)resource(path,'nodes');},
    width(length,path){if(length>VALUE_V2_LIMITS.nodes-nodes)resource(path,'nodes');},
    bytes(n,path){bytes+=n;if(bytes>VALUE_V2_LIMITS['encoded-bytes'])resource(path,'encoded-bytes');},
    string(s,path){bytes+=stringBytes(s,VALUE_V2_LIMITS['encoded-bytes']-bytes,path);},
  };
}

function snapshot(root,requireFrozen=false) {
  const b=budget(),active=new WeakSet();
  function copy(value,depth,path) {
    b.node(depth,path);
    if(value===null||typeof value==='boolean'){b.bytes(value===null?4:value?4:5,path);return value;}
    if(typeof value==='string'){b.string(value,path);return value;}
    if(typeof value==='number') {
      if(!Number.isFinite(value))invalid(path,'non-json-data');
      b.bytes(JSON.stringify(value).length,path);return value;
    }
    if(typeof value!=='object')invalid(path,'non-json-data');
    if(active.has(value))invalid(path,'non-json-data');
    const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
    if(array&&proto!==Array.prototype)invalid(path,'record-shape');
    if(!array&&proto!==Object.prototype&&proto!==null)invalid(path,'record-shape');
    if(requireFrozen&&!Object.isFrozen(value))invalid(path,'mutable-value');
    if(array)b.width(value.length,path);
    const keys=Reflect.ownKeys(value);
    if(array) {
      if(keys.length!==value.length+1)invalid(path,'field-set');
      for(const key of keys)if(key!=='length'&&(typeof key!=='string'||! /^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length))invalid(path,'field-set');
    }else b.width(keys.length,path);
    active.add(value);
    const out=array?[]:{};
    b.bytes(2+Math.max(0,(array?value.length:keys.length)-1),path);
    for(const key of keys) {
      if(array&&key==='length')continue;
      const at=pointer(path,key),d=Object.getOwnPropertyDescriptor(value,key);
      if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))invalid(at,'field-set');
      if(!array){b.string(key,at);b.bytes(1,at);}
      Object.defineProperty(out,key,{value:copy(d.value,depth+1,at),enumerable:true,configurable:true,writable:true});
    }
    active.delete(value);
    return Object.freeze(out);
  }
  return copy(root,0,'');
}

function stringEnd(text,start) {
  let i=start+1;
  for(;i<text.length;i++) {
    if(text[i]==='\\')i++;
    else if(text[i]==='"')return i+1;
  }
  throw new SyntaxError('unterminated JSON string');
}
const skipSpace=(text,start)=>{while(start<text.length&&/[\x20\t\r\n]/.test(text[start]))start++;return start;};

// Identify only the root's LAST version field, without constructing a tree.
// This preserves old v1 decoding even for noncanonical field order/duplicates.
export function encodedValueVersion(text) {
  if(typeof text!=='string')return undefined;
  let depth=0,version;
  try {
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(c==='"') {
        const end=stringEnd(text,i),colon=skipSpace(text,end);
        if(depth===1&&text[colon]===':'&&end-i<=74&&JSON.parse(text.slice(i,end))==='valueVersion') {
          const start=skipSpace(text,colon+1);
          const number=/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
          number.lastIndex=start;
          const token=number.exec(text);
          version=token?Number(token[0]):undefined;
        }
        i=end-1;
      }else if(c==='{'||c==='[')depth++;
      else if(c==='}'||c===']')depth--;
    }
  }catch{return undefined;}
  return version;
}

// Bound tree allocation BEFORE native JSON.parse. Whitespace costs a scan,
// not additional nodes/bytes. Native parsing still owns JSON syntax validation.
function preflightJSON(text) {
  const b=budget();let depth=0;
  for(let i=0;i<text.length;) {
    const c=text[i];
    if(/[\x20\t\r\n]/.test(c)){i++;continue;}
    if(c==='{'||c==='['){b.node(depth,'');depth++;b.bytes(1,'');i++;continue;}
    if(c==='}'||c===']'){depth--;b.bytes(1,'');i++;continue;}
    if(c===','||c===':'){b.bytes(1,'');i++;continue;}
    if(c==='"') {
      const end=stringEnd(text,i);
      if(end-i>6*VALUE_V2_LIMITS['encoded-bytes']+2)resource('','encoded-bytes');
      const key=text[skipSpace(text,end)]===':';
      if(!key)b.node(depth,'');
      b.string(JSON.parse(text.slice(i,end)),'');i=end;continue;
    }
    let end=i;
    while(end<text.length&&!/[\x20\t\r\n,\]}:]/.test(text[end]))end++;
    if(end===i)throw new SyntaxError('invalid JSON token');
    b.node(depth,'');
    const token=text.slice(i,end);
    if(token==='true'||token==='false'||token==='null')b.bytes(token.length,'');
    else {
      const n=JSON.parse(token);
      if(typeof n!=='number'||!Number.isFinite(n))invalid('','non-json-data');
      b.bytes(JSON.stringify(n).length,'');
    }
    i=end;
  }
}

function record(value,keys,path) {
  if(!value||typeof value!=='object'||Array.isArray(value))invalid(path,'record-shape');
  const actual=Object.keys(value);
  if(actual.length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))invalid(path,'field-set');
}
function array(value,path,nonempty=false) {if(!Array.isArray(value)||(nonempty&&!value.length))invalid(path,'leaf-shape');}
function id(value,path,versioned=false) {if(typeof value!=='string'||!(versioned?VERSIONED_ID:ID).test(value))invalid(path);}

export function createValueV2Codec(validateV1) {
  function v1(value,path) {
    if(value?.valueVersion!==1)invalid(path,'nesting-version');
    try{validateV1(value);}catch{invalid(path,'leaf-shape');}
    return value;
  }
  function scalar(value,path,count=false) {
    v1(value,path);
    const expr=value.data?.expr;
    if(value.kind!=='expression'||!['integer','rational'].includes(expr?.op))invalid(path);
    if(count&&(expr.op!=='integer'||!/^(0|[1-9]\d*)$/.test(expr.value)))invalid(path);
    return value;
  }
  function visit(value,path) {
    record(value,['valueVersion','kind','data'],path);
    const version=value.valueVersion;
    if(typeof version!=='number'||!Number.isInteger(version))invalid(pointer(path,'valueVersion'),'version-shape');
    if(version===1)return v1(value,path);
    if(version!==2)unsupported(pointer(path,'valueVersion'),'value-version',version,['1','2']);
    if(typeof value.kind!=='string'||!value.kind)invalid(pointer(path,'kind'));
    let data;
    const d=value.data,at=pointer(path,'data');
    if(value.kind==='list') {
      record(d,['items'],at);array(d.items,pointer(at,'items'));
      data={items:Object.freeze(d.items.map((child,i)=>visit(child,pointer(pointer(at,'items'),i))))};
    }else if(value.kind==='statistics') {
      if(!d||typeof d!=='object'||Array.isArray(d))invalid(at,'record-shape');
      if(d.variant==='grouped-data') {
        record(d,['variant','basisKind','classes'],at);
        if(d.basisKind!=='interval-grouped')invalid(pointer(at,'basisKind'),'variant-shape');
        array(d.classes,pointer(at,'classes'),true);
        const classes=d.classes.map((c,i)=>{
          const p=pointer(pointer(at,'classes'),i);
          record(c,['lower','upper','lowerClosed','upperClosed','count'],p);
          if(typeof c.lowerClosed!=='boolean'||typeof c.upperClosed!=='boolean')invalid(p);
          return Object.freeze({lower:scalar(c.lower,pointer(p,'lower')),upper:scalar(c.upper,pointer(p,'upper')),lowerClosed:c.lowerClosed,upperClosed:c.upperClosed,count:scalar(c.count,pointer(p,'count'),true)});
        });
        data={variant:d.variant,basisKind:d.basisKind,classes:Object.freeze(classes)};
      }else if(d.variant==='statistical-result') {
        record(d,['variant','statisticId','methodId','estimand','arithmetic','estimateStatus','assumptions','provenance','value'],at);
        id(d.statisticId,pointer(at,'statisticId'));id(d.methodId,pointer(at,'methodId'),true);id(d.estimand,pointer(at,'estimand'),true);
        if(!['exact','approximate'].includes(d.arithmetic)||!['known','estimated'].includes(d.estimateStatus))invalid(at);
        array(d.assumptions,pointer(at,'assumptions'));
        d.assumptions.forEach((a,i)=>id(a,pointer(pointer(at,'assumptions'),i),true));
        if(new Set(d.assumptions).size!==d.assumptions.length)invalid(pointer(at,'assumptions'));
        const p=pointer(at,'provenance');record(d.provenance,['inputs'],p);array(d.provenance.inputs,pointer(p,'inputs'),true);
        const roles=new Set();
        const inputs=d.provenance.inputs.map((input,i)=>{
          const pos=pointer(pointer(p,'inputs'),i);record(input,['role','value'],pos);id(input.role,pointer(pos,'role'));
          if(roles.has(input.role))invalid(pointer(pos,'role'));roles.add(input.role);
          return Object.freeze({role:input.role,value:visit(input.value,pointer(pos,'value'))});
        });
        data={variant:d.variant,statisticId:d.statisticId,methodId:d.methodId,estimand:d.estimand,arithmetic:d.arithmetic,estimateStatus:d.estimateStatus,assumptions:Object.freeze([...d.assumptions].sort()),provenance:Object.freeze({inputs:Object.freeze(inputs)}),value:v1(d.value,pointer(at,'value'))};
      }else {
        if(typeof d.variant!=='string'||!d.variant)invalid(pointer(at,'variant'),'variant-shape');
        unsupported(pointer(at,'variant'),'statistics-variant',d.variant,['grouped-data','statistical-result']);
      }
    }else unsupported(pointer(path,'kind'),'value-kind',value.kind,['statistics','list']);
    return Object.freeze({valueVersion:2,kind:value.kind,data:Object.freeze(data)});
  }
  const build = value => visit(snapshot(value),'');
  return Object.freeze({
    build,
    encode(value){return JSON.stringify(visit(snapshot(value,true),''));},
    recognize(value){try{visit(snapshot(value,true),'');return true;}catch{return false;}},
    decode(text){
      if(typeof text!=='string')invalid('','json-syntax');
      let parsed;
      try{preflightJSON(text);parsed=JSON.parse(text);}catch(error){if(error.diagnostic)throw error;invalid('','json-syntax');}
      return build(parsed);
    },
  });
}
