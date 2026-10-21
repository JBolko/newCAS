/** S97c: read-only views over runtime-owned data, never another document model. */
import {isValue} from './values/value.js';
import {isDiagnostic} from './diagnostics/diagnostic.js';

function immutableContract(value) {
    if (!value || !Object.isFrozen(value)) return false;
    const active = new WeakSet(), verified = new WeakSet();
    function frozenData(node) {
        if (node === null || ['string','boolean','undefined'].includes(typeof node)) return true;
        if (typeof node === 'number') return Number.isFinite(node);
        if (typeof node !== 'object' || active.has(node)) return false;
        if (verified.has(node)) return true; // Shared acyclic data is permitted.
        const array = Array.isArray(node), proto = Object.getPrototypeOf(node);
        if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
            return false; // Frozen exotic internal slots are not immutable data.
        if (!Object.isFrozen(node)) return false;
        active.add(node);
        const safe = Reflect.ownKeys(node).every(key => {
            const d = Object.getOwnPropertyDescriptor(node,key);
            return typeof key === 'string' && 'value' in d &&
                (d.enumerable || (array && key === 'length')) && frozenData(d.value);
        });
        active.delete(node);
        if (safe) verified.add(node);
        return safe;
    }
    return frozenData(value) && (isValue(value) || isDiagnostic(value));
}

/** Admit inert data only. Never execute caller accessors or retain mutable aliases. */
export function isolateRuntimeInput(value, ancestors = new Set()) {
    if (value === null || ['string','boolean','undefined'].includes(typeof value)) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object' || ancestors.has(value)) throw new TypeError('S97C_INPUT_INVALID');
    if (immutableContract(value)) return value;
    const proto = Object.getPrototypeOf(value);
    if (Array.isArray(value) ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
        throw new TypeError('S97C_INPUT_INVALID');
    ancestors.add(value);
    const copy = Array.isArray(value) ? [] : Object.create(proto);
    for (const key of Reflect.ownKeys(value)) {
        if (Array.isArray(value) && key === 'length') continue;
        const d = Object.getOwnPropertyDescriptor(value,key);
        if (typeof key !== 'string' || !d.enumerable || !('value' in d)) throw new TypeError('S97C_INPUT_INVALID');
        Object.defineProperty(copy,key,{value:isolateRuntimeInput(d.value,ancestors),
            enumerable:d.enumerable,writable:true,configurable:true});
    }
    if (Array.isArray(value)) copy.length = value.length;
    ancestors.delete(value);
    return copy;
}

export function createRuntimeReadonlyViews() {
    const views = new WeakMap();
    const reject = () => { throw new TypeError('S97C_READ_ONLY'); };
    function view(value, resolve = null) {
        if (!value || typeof value !== 'object' || immutableContract(value)) return value;
        if (!resolve && views.has(value)) return views.get(value);
        const read = resolve || (() => value);
        // Shadow target avoids frozen-property Proxy invariants exposing nested data.
        const target = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
        let proxy;
        proxy = new Proxy(target, {
            get(_target,key) {
                const current = read();
                if (current instanceof Map || current instanceof Set) {
                    if (['set','add','delete','clear'].includes(key)) return reject;
                    if (key === 'size') return current.size;
                    if (key === 'get' && current instanceof Map) return k => view(current.get(k));
                    if (key === 'has') return k => current.has(k);
                    if (key === 'forEach') return (callback,thisArg) => current.forEach((v,k) =>
                        callback.call(thisArg,view(v),view(k),proxy));
                    if (key === Symbol.iterator || ['entries','values','keys'].includes(key)) {
                        return function* () {
                            const method = current[key].bind(current);
                            for (const item of method()) yield view(item);
                        };
                    }
                }
                return view(Reflect.get(current,key,proxy));
            },
            has(_target,key) { return key in read(); },
            ownKeys() { return Reflect.ownKeys(read()); },
            getOwnPropertyDescriptor(_target,key) {
                const d = Object.getOwnPropertyDescriptor(read(),key);
                if (!d) return undefined;
                return {value:view(Reflect.get(read(),key,proxy)),enumerable:d.enumerable,
                    writable:true,configurable:!(Array.isArray(target) && key === 'length')};
            },
            set:reject, defineProperty:reject, deleteProperty:reject,
            setPrototypeOf:reject, preventExtensions:reject,
        });
        if (!resolve) views.set(value,proxy);
        return proxy;
    }
    return view;
}
