import { createRequire } from "node:module";
import { join } from "node:path";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import https from "node:https";
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/cosmokit/lib/index.js
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject$1(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
/** Define a non-enumerable writable property and return the object. */
function defineProperty(object, key, value) {
	return Object.defineProperty(object, key, {
		writable: true,
		value,
		enumerable: false
	});
}
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
/** Binary source detection and base64/hex conversion helpers. */
var Binary;
(function(Binary) {
	Binary.is = isArrayBufferLike;
	Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
function deepEqual(a, b, strict) {
	if (a === b) return true;
	if (!strict && isNullable(a) && isNullable(b)) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (!a || !b) return false;
	function check(test, then) {
		return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
	}
	return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
		if (a.byteLength !== b.byteLength) return false;
		const viewA = new Uint8Array(a);
		const viewB = new Uint8Array(b);
		for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
		return true;
	}) ?? Object.keys({
		...a,
		...b
	}).every((key) => deepEqual(a[key], b[key], strict));
}
function tokenize(source, delimiters, delimiter) {
	const output = [];
	let state = 0;
	for (let i = 0; i < source.length; i++) {
		const code = source.charCodeAt(i);
		if (code >= 65 && code <= 90) {
			if (state === 1) {
				const next = source.charCodeAt(i + 1);
				if (next >= 97 && next <= 122) output.push(delimiter);
				output.push(code + 32);
			} else {
				if (state !== 0) output.push(delimiter);
				output.push(code + 32);
			}
			state = 1;
		} else if (code >= 97 && code <= 122) {
			output.push(code);
			state = 2;
		} else if (delimiters.includes(code)) {
			if (state !== 0) output.push(delimiter);
			state = 0;
		} else output.push(code);
	}
	return String.fromCharCode(...output);
}
/** Convert text to dash-delimited parameter case. */
function paramCase(source) {
	return tokenize(source, [45, 95], 45);
}
/** Runtime alias for `paramCase`. */
const hyphenate = paramCase;
/** Time constants plus parsing and formatting helpers. */
var Time;
(function(Time) {
	Time.millisecond = 1;
	Time.second = 1e3;
	Time.minute = Time.second * 60;
	Time.hour = Time.minute * 60;
	Time.day = Time.hour * 24;
	Time.week = Time.day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
	}
	Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * Time.day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * Time.minute);
	}
	Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
	}
	Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= Time.day - Time.hour / 2) return Math.round(ms / Time.day) + "d";
		else if (abs >= Time.hour - Time.minute / 2) return Math.round(ms / Time.hour) + "h";
		else if (abs >= Time.minute - Time.second / 2) return Math.round(ms / Time.minute) + "m";
		else if (abs >= Time.second) return Math.round(ms / Time.second) + "s";
		return ms + "ms";
	}
	Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/cordis/lib/index.js
/** Ordered collection of disposable values with O(1) deletion by value. */
var DisposableList = class {
	sn = 0;
	map = /* @__PURE__ */ new Map();
	weak = /* @__PURE__ */ new WeakMap();
	get length() {
		return this.map.size;
	}
	push(value) {
		const sn = ++this.sn;
		this.map.set(sn, value);
		this.weak.set(value, sn);
		return () => this.map.delete(sn);
	}
	delete(value) {
		const sn = this.weak.get(value);
		if (!sn) return false;
		return this.map.delete(sn);
	}
	clear() {
		const values = [...this.map.values()];
		this.map.clear();
		return values.reverse();
	}
	[Symbol.iterator]() {
		return this.map.values();
	}
	[Symbol.for("nodejs.util.inspect.custom")]() {
		return [...this];
	}
};
/** Shared symbols used to avoid public property-name collisions. */
const symbols = {
	shadow: Symbol.for("cordis.shadow"),
	receiver: Symbol.for("cordis.receiver"),
	original: Symbol.for("cordis.original"),
	metadata: Symbol.for("cordis.metadata"),
	initHooks: Symbol.for("cordis.initHooks"),
	checkProto: Symbol.for("cordis.checkProto"),
	effect: Symbol.for("cordis.effect"),
	filter: Symbol.for("cordis.filter"),
	isolate: Symbol.for("cordis.isolate"),
	intercept: Symbol.for("cordis.intercept"),
	init: Symbol.for("cordis.init"),
	check: Symbol.for("cordis.check"),
	config: Symbol.for("cordis.config"),
	invoke: Symbol.for("cordis.invoke"),
	extend: Symbol.for("cordis.extend"),
	tracker: Symbol.for("cordis.tracker"),
	resolveConfig: Symbol.for("cordis.resolveConfig")
};
const GeneratorFunction = function* () {}.constructor;
const AsyncGeneratorFunction = async function* () {}.constructor;
/** Return true when a plugin callback should be constructed with `new`. */
function isConstructor(func) {
	if (!func.prototype) return false;
	if (func instanceof GeneratorFunction) return false;
	if (AsyncGeneratorFunction !== Function && func instanceof AsyncGeneratorFunction) return false;
	return true;
}
/** Merge two prototype chains while preserving descriptors from `proto1`. */
function joinPrototype(proto1, proto2) {
	if (proto1 === Object.prototype) return proto2;
	const result = Object.create(joinPrototype(Object.getPrototypeOf(proto1), proto2));
	for (const key of Reflect.ownKeys(proto1)) Object.defineProperty(result, key, Object.getOwnPropertyDescriptor(proto1, key));
	return result;
}
/** Return true for non-null objects and functions. */
function isObject(value) {
	return value && (typeof value === "object" || typeof value === "function");
}
/** Find a property descriptor by walking an object's prototype chain. */
function getPropertyDescriptor(target, prop) {
	let proto = target;
	while (proto) {
		const desc = Reflect.getOwnPropertyDescriptor(proto, prop);
		if (desc) return desc;
		proto = Object.getPrototypeOf(proto);
	}
}
/** Wrap services/functions so method calls see the caller's active context. */
function getTraceable(ctx, value) {
	if (!isObject(value)) return value;
	if (Object.hasOwn(value, symbols.shadow)) return Object.getPrototypeOf(value);
	const tracker = value[symbols.tracker];
	if (!tracker) return value;
	return createTraceable(ctx, value, tracker);
}
/** Return a proxy that overlays readonly or writable properties onto a target. */
function withProps(target, props) {
	if (!props) return target;
	return new Proxy(target, {
		get: (target, prop, receiver) => {
			if (prop in props && prop !== "constructor") return Reflect.get(props, prop, receiver);
			return Reflect.get(target, prop, receiver);
		},
		set: (target, prop, value, receiver) => {
			if (prop in props && prop !== "constructor") return Reflect.set(props, prop, value, receiver);
			return Reflect.set(target, prop, value, receiver);
		}
	});
}
function withProp(target, prop, value) {
	return withProps(target, Object.defineProperty(Object.create(null), prop, {
		value,
		writable: false
	}));
}
function createShadow(ctx, target, property, receiver) {
	if (!property) return receiver;
	const origin = Reflect.getOwnPropertyDescriptor(target, property)?.value;
	if (!origin) return receiver;
	return withProp(receiver, property, ctx.extend({ [symbols.shadow]: origin }));
}
function createShadowMethod(ctx, value, outer, shadow) {
	return new Proxy(value, { apply: (target, thisArg, args) => {
		if (thisArg === outer) thisArg = shadow;
		return getTraceable(ctx, Reflect.apply(target, thisArg, args));
	} });
}
function createTraceable(ctx, value, tracker) {
	if (ctx[symbols.shadow] && !tracker.noShadow) ctx = Object.getPrototypeOf(ctx);
	const proxy = new Proxy(value, {
		get: (target, prop, receiver) => {
			if (prop === symbols.original) return target;
			if (prop === tracker.property) return ctx;
			if (typeof prop === "symbol") return Reflect.get(target, prop, receiver);
			if (tracker.associate && ctx.reflect.props[`${tracker.associate}.${prop}`]) return Reflect.get(ctx, `${tracker.associate}.${prop}`, withProp(ctx, symbols.receiver, receiver));
			let shadow, innerValue;
			const desc = getPropertyDescriptor(target, prop);
			if (desc && "value" in desc) innerValue = desc.value;
			else {
				shadow = createShadow(ctx, target, tracker.property, receiver);
				innerValue = Reflect.get(target, prop, shadow);
			}
			const innerTracker = innerValue?.[symbols.tracker];
			if (innerTracker) return createTraceable(ctx, innerValue, innerTracker);
			else if (!tracker.noShadow && typeof innerValue === "function") {
				shadow ??= createShadow(ctx, target, tracker.property, receiver);
				return createShadowMethod(ctx, innerValue, receiver, shadow);
			} else return innerValue;
		},
		set: (target, prop, value, receiver) => {
			if (prop === symbols.original) return false;
			if (prop === tracker.property) return false;
			if (typeof prop === "symbol") return Reflect.set(target, prop, value, receiver);
			if (tracker.associate && ctx.reflect.props[`${tracker.associate}.${prop}`]) return Reflect.set(ctx, `${tracker.associate}.${prop}`, value, withProp(ctx, symbols.receiver, receiver));
			const shadow = createShadow(ctx, target, tracker.property, receiver);
			return Reflect.set(target, prop, value, shadow);
		},
		apply: (target, thisArg, args) => {
			return applyTraceable(proxy, target, thisArg, args);
		}
	});
	return proxy;
}
function applyTraceable(proxy, value, thisArg, args) {
	if (!value[symbols.invoke]) return Reflect.apply(value, thisArg, args);
	return value[symbols.invoke].apply(proxy, args);
}
/** Create a callable service object that dispatches through `symbols.invoke`. */
function createCallable(name, proto, tracker) {
	const self = function(...args) {
		return applyTraceable(createTraceable(self["ctx"], self, tracker), self, this, args);
	};
	defineProperty(self, "name", name);
	return Object.setPrototypeOf(self, proto);
}
function handleError(info, reason, getOuterStack) {
	const innerLines = info.error.stack.split("\n");
	if (typeof reason?.stack !== "string") {
		const outerError = new Error(reason);
		const lines = outerError.stack.split("\n");
		lines.splice(1, Infinity, ...getOuterStack());
		outerError.stack = lines.join("\n");
		throw outerError;
	}
	const lines = reason.stack.split("\n");
	let index = lines.indexOf(innerLines[2]);
	if (index === -1) throw reason;
	index -= info.offset;
	while (index > 0) {
		if (!lines[index - 1].endsWith(" (<anonymous>)")) break;
		index -= 1;
	}
	lines.splice(index, Infinity, ...getOuterStack());
	reason.stack = lines.join("\n");
	throw reason;
}
/** Run a callback and splice outer call-site frames into thrown async errors. */
function composeError(callback, getOuterStack = buildOuterStack()) {
	const info = {
		offset: 1,
		error: /* @__PURE__ */ new Error()
	};
	try {
		const result = callback(info);
		if (isObject(result) && "then" in result) return result.then(void 0, (reason) => handleError(info, reason, getOuterStack));
		else return result;
	} catch (reason) {
		handleError(info, reason, getOuterStack);
	}
}
/** Capture a lazy stack-frame supplier for later error composition. */
function buildOuterStack(offset = 0) {
	const outerError = /* @__PURE__ */ new Error();
	return () => outerError.stack.split("\n").slice(3 + offset);
}
/**
* Return whether an event result should stop a bail-style dispatch.
*
* @param value — a listener's return value.
* @returns `true` unless `value` is `null`, `false`, or `undefined`.
*/
function isBailed(value) {
	return value !== null && value !== false && value !== void 0;
}
/**
* Event bus installed as `ctx.events` and mixed into every context.
*
* The service supports concurrent, synchronous, serial, bail, and waterfall
* dispatch and automatically disposes listeners with their owning fiber.
*/
var EventsService = class {
	ctx;
	_hooks = {};
	constructor(ctx) {
		this.ctx = ctx;
		defineProperty(this, symbols.tracker, {
			property: "ctx",
			noShadow: true
		});
		this.on("internal/listener", function(name, listener, options) {
			if (name === "internal/update" && !options.global) return (this.fiber._hooks["internal/update"] ??= new DisposableList())[options.prepend ? "unshift" : "push"](listener);
		});
		this.on("internal/update", function(config, noSave, next) {
			const cbs = [...this._hooks["internal/update"] || []];
			const _next = () => {
				return (cbs.shift() ?? next).call(this, config, noSave, _next);
			};
			return _next();
		}, {
			global: true,
			prepend: true
		});
	}
	/**
	* Resolve listeners for one dispatch and apply context filtering.
	*
	* @param type — the dispatch mode, reported on `internal/dispatch`.
	* @param args — the raw dispatch arguments; consumed up to the event name.
	* @returns the matching listener callbacks, bound to the dispatch `this`.
	*/
	dispatch(type, args) {
		const thisArg = typeof args[0] === "object" || typeof args[0] === "function" ? args.shift() : null;
		const name = args.shift();
		if (!name.startsWith("internal/")) this.emit("internal/dispatch", type, name, args, thisArg);
		const filter = thisArg?.[Context.filter];
		return (this._hooks[name] || []).filter((hook) => hook.global || !filter || filter.call(thisArg, hook.ctx)).map((hook) => hook.callback.bind(thisArg));
	}
	/**
	* Run listeners concurrently and wait for all of them.
	*
	* @param args — optional `this`, the event name, then listener arguments.
	* @returns a promise resolving once every listener has settled.
	*/
	async parallel(...args) {
		const errors = (await Promise.allSettled(this.dispatch("emit", args).map(async (cb) => cb(...args)))).filter((result) => result.status === "rejected");
		if (errors.length) throw new AggregateError(errors.map((error) => error.reason));
	}
	/**
	* Run listeners synchronously without waiting for returned promises.
	*
	* @param args — optional `this`, the event name, then listener arguments.
	*/
	emit(...args) {
		this.dispatch("emit", args).map((cb) => cb(...args));
	}
	/**
	* Run listeners in order, awaiting each, until one returns a bail value.
	*
	* @param args — optional `this`, the event name, then listener arguments.
	* @returns the first bail value (see {@link isBailed}), if any.
	*/
	async serial(...args) {
		for (const cb of this.dispatch("serial", args)) {
			const result = await cb(...args);
			if (isBailed(result)) return result;
		}
	}
	/**
	* Run listeners synchronously until one returns a bail value.
	*
	* @param args — optional `this`, the event name, then listener arguments.
	* @returns the first bail value (see {@link isBailed}), if any.
	*/
	bail(...args) {
		for (const cb of this.dispatch("bail", args)) {
			const result = cb(...args);
			if (isBailed(result)) return result;
		}
	}
	/**
	* Compose listeners around the final `next` callback.
	*
	* The last dispatch argument is treated as the innermost `next`. Listeners
	* run outermost-first; a listener that does not call `next()` vetoes the
	* rest of the chain, including the built-in behavior.
	*
	* @param args — optional `this`, the event name, listener arguments, then `next`.
	* @returns the outermost listener's return value.
	*/
	waterfall(...args) {
		const cbs = this.dispatch("waterfall", args);
		const inner = args.pop();
		const next = () => {
			return (cbs.shift() ?? inner)(...args);
		};
		args.push(next);
		return next();
	}
	/**
	* Store a listener record as an effect on the current fiber.
	*
	* @param label — effect label shown in fiber diagnostics.
	* @param hooks — the listener list for one event.
	* @param callback — the listener to store.
	* @param options — placement and filtering options.
	* @returns a disposer that unregisters the listener.
	*/
	register(label, hooks, callback, options) {
		const method = options.prepend ? "unshift" : "push";
		return this.ctx.fiber.effect(() => {
			hooks[method]({
				ctx: this.ctx,
				callback,
				...options
			});
			return () => this.unregister(hooks, callback);
		}, label);
	}
	/**
	* Remove a stored listener record.
	*
	* @param hooks — the listener list for one event.
	* @param callback — the listener to remove.
	* @returns `true` if the listener was found and removed.
	*/
	unregister(hooks, callback) {
		const index = hooks.findIndex((hook) => hook.callback === callback);
		if (index >= 0) {
			hooks.splice(index, 1);
			return true;
		}
	}
	/**
	* Register an event listener owned by the current fiber.
	*
	* The listener is removed automatically when the fiber unloads. Throws
	* `CordisError('INACTIVE_EFFECT')` if the fiber is already disposed.
	*
	* @param name — the event name to listen for.
	* @param listener — called with the dispatch arguments.
	* @param options — listener options; a boolean is shorthand for `prepend`.
	* @returns a disposer removing the listener; `true` if it was still registered.
	*/
	on(name, listener, options) {
		if (typeof options !== "object") options = { prepend: options };
		this.ctx.fiber.assertActive();
		listener = this.ctx.reflect.bind(listener);
		const result = this.bail(this.ctx, "internal/listener", name, listener, options);
		if (result) return result;
		const hooks = this._hooks[name] ||= [];
		const label = `ctx.on(${typeof name === "string" ? JSON.stringify(name) : name.toString()})`;
		return this.register(label, hooks, listener, options);
	}
	/**
	* Register an event listener that disposes itself after the first call.
	*
	* @param name — the event name to listen for.
	* @param listener — called at most once with the dispatch arguments.
	* @param options — listener options; a boolean is shorthand for `prepend`.
	* @returns a disposer removing the listener; `true` if it was still registered.
	*/
	once(name, listener, options) {
		const dispose = this.on(name, function(...args) {
			dispose();
			return listener.apply(this, args);
		}, options);
		return dispose;
	}
};
/** Built-in placeholder formatters used by `Logger.format()`. */
const defaultFormatters = {
	s: (value) => String(value),
	d: (value) => Math.trunc(Number(value)),
	i: (value) => Math.trunc(Number(value)),
	f: (value) => Number(value),
	o: (value) => JSON.stringify(value),
	O: (value) => JSON.stringify(value),
	c: () => "",
	C: (value, exporter, message) => {
		return Logger.color(exporter, Logger.code(message.name, exporter.colors), value);
	}
};
function isAggregateError(error) {
	return error instanceof Error && Array.isArray(error["errors"]);
}
/** Logger facade for one named subsystem. */
var Logger = class {
	service;
	static color(exporter, code, value, decoration = "") {
		if (!exporter.colors) return "" + value;
		return `\u001b[3${code < 8 ? code : "8;5;" + code}${exporter.colors >= 2 ? decoration : ""}m${value}\u001b[0m`;
	}
	static code(name, level) {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = (hash << 3) - hash + name.charCodeAt(i) + 13;
			hash |= 0;
		}
		const colors = !level ? [] : level >= 2 ? c256 : c16;
		return colors[Math.abs(hash) % colors.length];
	}
	static format(exporter, message) {
		const args = message.args.slice();
		if (args[0] instanceof Error) {
			args[0] = args[0].stack || args[0].message;
			args.unshift("%s");
		} else if (typeof args[0] !== "string") args.unshift("%o");
		let format = args.shift();
		format = format.replace(/%([a-zA-Z%])/g, (match, char) => {
			if (match === "%%") return "%";
			const formatter = exporter.formatters?.[char] ?? defaultFormatters[char];
			if (typeof formatter === "function") return formatter(args.shift(), exporter, message);
			return match;
		});
		const oFormatter = exporter.formatters?.o ?? defaultFormatters.o;
		for (let arg of args) {
			if (typeof arg === "object" && arg) arg = oFormatter(arg, exporter, message);
			format += " " + arg;
		}
		const { maxLength = 10240 } = exporter;
		return format.split(/\r?\n/g).map((line) => {
			return line.slice(0, maxLength) + (line.length > maxLength ? "..." : "");
		}).join("\n");
	}
	constructor(options, service) {
		this.service = service;
		Object.assign(this, options);
		this.error = this._method("error", 0);
		this.info = this._method("info", 1);
		this.warn = this._method("warn", 2);
		this.debug = this._method("debug", 3);
	}
	_method(type, level) {
		return (...args) => {
			if (args.length === 1 && args[0] instanceof Error) {
				if (args[0].cause) this[type](args[0].cause);
				else if (isAggregateError(args[0])) {
					args[0].errors.forEach((error) => this[type](error));
					return;
				}
			}
			const sn = ++this.service._snMessage;
			const ts = Date.now();
			for (const exporter of this.service.exporters.values()) {
				if ((exporter.levels?.[this.name] ?? exporter.levels?.default ?? this.level ?? 1) < level) continue;
				const message = {
					sn,
					ts,
					type,
					level,
					name: this.name,
					...this.meta,
					args
				};
				exporter.export(message);
			}
		};
	}
};
/** ANSI 16-color palette indexes used for logger name coloring. */
const c16 = [
	6,
	2,
	3,
	4,
	5,
	1
];
/** ANSI 256-color palette indexes used for logger name coloring. */
const c256 = [
	20,
	21,
	26,
	27,
	32,
	33,
	38,
	39,
	40,
	41,
	42,
	43,
	44,
	45,
	56,
	57,
	62,
	63,
	68,
	69,
	74,
	75,
	76,
	77,
	78,
	79,
	80,
	81,
	92,
	93,
	98,
	99,
	112,
	113,
	129,
	134,
	135,
	148,
	149,
	160,
	161,
	162,
	163,
	164,
	165,
	166,
	167,
	168,
	169,
	170,
	171,
	172,
	173,
	178,
	179,
	184,
	185,
	196,
	197,
	198,
	199,
	200,
	201,
	202,
	203,
	204,
	205,
	206,
	207,
	208,
	209,
	214,
	215,
	220,
	221
];
/**
* Built-in logging service.
*
* Call `ctx.logger()` to create a named logger, or call `ctx.logger.info()`
* directly to log with the current fiber-derived name.
*/
var LoggerService = class LoggerService {
	bufferSize = 1e3;
	buffer = [];
	ctx;
	_snMessage = 0;
	_snExporter = 0;
	exporters = /* @__PURE__ */ new Map();
	constructor(ctx) {
		const tracker = {
			property: "ctx",
			noShadow: true
		};
		const self = createCallable("logger", joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
		Object.assign(self, this);
		self.ctx = ctx;
		defineProperty(self, symbols.tracker, tracker);
		self.exporter({
			colors: 3,
			export: (message) => {
				self.buffer.push(message);
				if (self.buffer.length > self.bufferSize) self.buffer = self.buffer.slice(-self.bufferSize);
			}
		});
		return self;
	}
	/**
	* Register an exporter and dispose it with the current fiber.
	*
	* @param exporter — the sink that receives structured log messages.
	* @returns a disposer that removes the exporter.
	*/
	exporter(exporter) {
		return this.ctx.effect(() => {
			this.exporters.set(++this._snExporter, exporter);
			return () => this.exporters.delete(this._snExporter);
		}, "ctx.logger.exporter()");
	}
	_resolveConfig() {
		let intercept = this.ctx[symbols.intercept];
		const configs = [];
		while ("logger" in intercept) {
			if (Object.hasOwn(intercept, "logger")) configs.unshift(intercept["logger"]);
			intercept = Object.getPrototypeOf(intercept);
		}
		return Object.assign({}, ...configs);
	}
	[symbols.invoke](name) {
		const config = this._resolveConfig();
		const fiber = (this.ctx[symbols.shadow] ?? this.ctx).fiber;
		name ??= config.name;
		name ??= hyphenate(fiber.name);
		return new Logger({
			name,
			level: config.level,
			meta: { fiber: new WeakRef(fiber) }
		}, this);
	}
	static {
		for (const type of [
			"error",
			"info",
			"warn",
			"debug"
		]) LoggerService.prototype[type] = function(...args) {
			return this()[type](...args);
		};
	}
};
function enhanceError(error) {
	const lines = error.stack.split("\n");
	lines.splice(0, 2, `Error: ${error.message}`);
	error.stack = lines.join("\n");
	return error;
}
const RESERVED_WORDS = ["prototype", "then"];
function isSpecialProperty(prop) {
	return typeof prop === "symbol" || RESERVED_WORDS.includes(prop) || parseInt(prop).toString() === prop || prop.startsWith("_");
}
/**
* Reflection and service-resolution layer installed as `ctx.reflect`.
*
* This service powers the context proxy, service registration, accessors, and
* the mixins that expose core service methods directly on `ctx`.
*/
var ReflectService = class {
	ctx;
	/** Proxy traps implementing service resolution for every context object. */
	static handler = {
		get: (target, prop, ctx) => {
			if (isSpecialProperty(prop)) return Reflect.get(target, prop, ctx);
			if (Reflect.has(target, prop)) return getTraceable(ctx, Reflect.get(target, prop, ctx));
			const error = /* @__PURE__ */ new Error(`cannot get property "${prop}" without inject`);
			try {
				const def = target.reflect.props[prop];
				if (def?.type === "accessor") return def.get.call(ctx, ctx[symbols.receiver], error);
				if (!ctx.fiber.runtime) return ctx.reflect.get(prop, false);
				return ctx.events.waterfall("internal/get", ctx, prop, error, () => {
					const key = target[symbols.isolate][prop];
					let fiber = (ctx[symbols.shadow] ?? ctx).fiber;
					while (true) {
						const impl = fiber.store?.[prop];
						if (impl) return getTraceable(ctx, impl.value);
						if (prop in fiber.inject) {
							error.message = `cannot get required service "${prop}" in inactive context`;
							throw error;
						}
						if (!fiber.runtime) throw error;
						if (fiber.parent[symbols.isolate][prop] !== key) throw error;
						fiber = fiber.parent.fiber;
					}
				});
			} catch (e) {
				throw e === error ? enhanceError(e) : e;
			}
		},
		set: (target, prop, value, ctx) => {
			if (isSpecialProperty(prop)) return Reflect.set(target, prop, value, ctx);
			const error = /* @__PURE__ */ new Error(`cannot set property "${prop}" without provide`);
			const def = target.reflect.props[prop];
			if (!def) {
				if (!ctx.fiber.runtime) return Reflect.set(target, prop, value, ctx);
				throw enhanceError(error);
			}
			try {
				if (def.type === "accessor") {
					if (!def.set) return false;
					return def.set.call(ctx, value, ctx[symbols.receiver], error);
				}
				return ctx.events.waterfall("internal/set", ctx, prop, value, error, () => {
					return ctx.reflect.set(prop, value, error);
				});
			} catch (e) {
				throw e === error ? enhanceError(e) : e;
			}
		},
		has: (target, prop) => {
			if (isSpecialProperty(prop)) return Reflect.has(target, prop);
			if (Reflect.has(target, prop)) return true;
			return !!target.reflect.props[prop];
		}
	};
	/** Service implementations, keyed by isolation label. */
	store = Object.create(null);
	/** Declared context properties (services and accessors), by name. */
	props = Object.create(null);
	constructor(ctx) {
		this.ctx = ctx;
		defineProperty(this, symbols.tracker, {
			property: "ctx",
			noShadow: true
		});
		this.mixin("reflect", [
			"get",
			"set",
			"provide",
			"accessor",
			"mixin"
		]);
		this.mixin("fiber", ["runtime", "effect"]);
		this.mixin("registry", ["inject", "plugin"]);
		this.mixin("events", [
			"on",
			"once",
			"parallel",
			"emit",
			"serial",
			"bail",
			"waterfall"
		]);
	}
	/**
	* Read a service from the store without the inject requirement.
	*
	* @param name — the service name.
	* @param strict — when `true`, only return implementations whose providing
	* fiber is currently active.
	* @returns the service value, or `undefined` when not (yet) provided.
	*/
	get(name, strict = true) {
		return getTraceable(this.ctx, this._getImpl(name, strict)?.value);
	}
	_getImpl(name, strict = true) {
		const key = this.ctx[symbols.isolate][name];
		const impl = key && this.store[key];
		if (!impl) return;
		if (strict && impl.fiber.state !== 2) return;
		return impl;
	}
	/**
	* Overwrite a provided service's value.
	*
	* @param name — the service name.
	* @param value — the new service value.
	* @param error — carrier for the caller stack in diagnostics.
	* @returns `true` on success.
	* @throws when `name` was never provided, or was provided by another fiber.
	*/
	set(name, value, error) {
		const key = this.ctx[symbols.isolate][name];
		const impl = this.store[key];
		if (!impl) throw new Error(`cannot set property "${name}" without provide`);
		if (impl.fiber !== this.ctx.fiber) throw new Error(`cannot set property "${name}" in multiple fibers`);
		impl.value = value;
		return true;
	}
	/**
	* Register a service implementation owned by the current fiber.
	*
	* See the `ctx.provide()` overload above for the full contract.
	*
	* @param name — the service name.
	* @param value — the service value.
	* @param check — optional availability predicate for dependents.
	* @returns a disposer that unregisters the service.
	*/
	provide(name, value, check) {
		return this.ctx.fiber.effect(() => {
			if (!this.props[name]) this.props[name] ??= { type: "service" };
			else if (this.props[name].type !== "service") throw new Error(`property "${name}" is already declared as ${this.props[name].type}`);
			this.props[name] = { type: "service" };
			this.ctx.root[symbols.isolate][name] ??= Symbol(name);
			const key = this.ctx[symbols.isolate][name];
			const impl = {
				name,
				value,
				fiber: this.ctx.fiber,
				check
			};
			if (this.store[key]) throw new Error(`service "${name}" has been registered at <${this.store[key].fiber.name}>`);
			this.store[key] = impl;
			this.ctx.fiber.store[name] = impl;
			if (this.ctx.fiber.state === 2) this.notify([name]);
			return async () => {
				delete this.store[key];
				const fibers = this.notify([name]);
				await Promise.allSettled(fibers.map((fiber) => fiber.await()));
				delete this.ctx.fiber.store[name];
			};
		}, `ctx.provide(${JSON.stringify(name)})`);
	}
	/**
	* Re-evaluate every fiber that requires one of the given services.
	*
	* @param names — the service names that changed.
	* @param filter — restricts notification to matching isolation scopes.
	* @returns the fibers whose dependency state was refreshed.
	*/
	notify(names, filter = (ctx, name) => ctx[symbols.isolate][name] === this.ctx[symbols.isolate][name]) {
		const fibers = [];
		for (const runtime of this.ctx.registry.values()) for (const fiber of runtime.fibers) {
			let hasUpdate = false;
			for (const name of names) {
				if (!(name in fiber.inject)) continue;
				if (!filter(fiber.ctx, name)) continue;
				hasUpdate = true;
				fiber._checkImpl(name);
			}
			if (!hasUpdate) continue;
			fiber._refresh();
			fibers.push(fiber);
		}
		for (const name of names) {
			const self = Object.create(this.ctx);
			self[symbols.filter] = (target) => filter(target, name);
			this.ctx.events.emit(self, "internal/service", name, this._getImpl(name, false)?.value);
		}
		return fibers;
	}
	/**
	* Define a computed context property backed by get/set hooks.
	*
	* @param name — the context property name.
	* @param options — the `get` hook and optional `set` hook.
	* @returns a disposer that removes the accessor.
	*/
	accessor(name, options) {
		return this.ctx.fiber.effect(() => {
			if (name in this.props) throw new Error(`property "${name}" is already declared as ${this.props[name].type}`);
			this.props[name] = {
				type: "accessor",
				...options
			};
			return () => delete this.props[name];
		}, `ctx.accessor(${JSON.stringify(name)})`);
	}
	/**
	* Expose selected members of a service directly on `ctx`.
	*
	* See the `ctx.mixin()` overload above for the full contract.
	*
	* @param source — a context property name or a source object.
	* @param mixins — keys to forward, or a source-key → ctx-key map.
	* @returns a disposer that removes all created accessors.
	*/
	mixin(source, mixins) {
		const self = this;
		return this.ctx.fiber.effect(function* () {
			const entries = Array.isArray(mixins) ? mixins.map((key) => [key, key]) : Object.entries(mixins);
			const getTarget = (ctx, error) => {
				return ctx[source];
			};
			for (const [key, value] of entries) yield self.accessor(value, {
				get(receiver, error) {
					const service = getTarget(this, error);
					if (isNullable(service)) return service;
					const mixin = receiver ? withProps(receiver, service) : service;
					const value = Reflect.get(service, key, mixin);
					if (typeof value !== "function") return value;
					return value.bind(mixin ?? service);
				},
				set(value, receiver, error) {
					const service = getTarget(this, error);
					const mixin = receiver ? withProps(receiver, service) : service;
					return Reflect.set(service, key, value, mixin);
				}
			});
		}, `ctx.mixin(${JSON.stringify(source)})`);
	}
	/**
	* Attach this context's tracing wrapper to a value.
	*
	* @param value — the value to wrap.
	* @returns the traceable wrapper (or the value itself when not applicable).
	*/
	trace(value) {
		return getTraceable(this.ctx, value);
	}
	/**
	* Wrap a callback so calls trace `this` and arguments to this context.
	*
	* @param callback — the function to wrap.
	* @returns a proxy delegating to `callback` with traced values.
	*/
	bind(callback) {
		return new Proxy(callback, {
			apply: (target, thisArg, args) => {
				return Reflect.apply(target, this.trace(thisArg), args.map((arg) => this.trace(arg)));
			},
			construct: (target, args, newTarget) => {
				return Reflect.construct(target, args.map((arg) => this.trace(arg)), newTarget);
			}
		});
	}
};
const kValidationError$1 = Symbol.for("ValidationError");
/** Error raised when plugin configuration fails standard-schema validation. */
var ValidationError$1 = class extends TypeError {
	name = "ValidationError";
	/**
	* Build the aggregated message from schema issues.
	*
	* @param issues — the standard-schema issues, one message line each.
	*/
	constructor(issues) {
		super(`invalid config:\n` + issues.map((issue) => {
			if (issue.path) return `  - ${issue.message} (at ${issue.path.join(".")})`;
			else return `  - ${issue.message}`;
		}).join("\n"));
	}
};
Object.defineProperty(ValidationError$1.prototype, kValidationError$1, { value: true });
/**
* Validate and normalize config for a plugin runtime before it starts.
*
* @param runtime — the plugin runtime whose `Config` schema to apply.
* @param config — the raw user config.
* @returns the validated config, or `config` unchanged if the runtime has no schema.
* @throws {ValidationError} when validation reports issues.
*/
function resolveConfig(runtime, config) {
	if (!runtime.Config) return config;
	const result = runtime.Config["~standard"].validate(config);
	if ("then" in result) throw new TypeError("Async config validation is not supported");
	if (result.issues) throw new ValidationError$1(result.issues);
	else return result.value;
}
const effectInertia = /* @__PURE__ */ new WeakMap();
function runDisposable(dispose) {
	const result = dispose();
	return effectInertia.get(dispose)?.() ?? result;
}
/** Notify plugin teardown without allowing one observer to break ownership cleanup. */
function emitPluginDisposed(context, fiber) {
	const args = ["internal/plugin", fiber];
	let callbacks;
	try {
		callbacks = context.events.dispatch("emit", args);
	} catch (error) {
		context.logger.error(error);
		return;
	}
	for (const callback of callbacks) try {
		const returned = callback(...args);
		Promise.resolve(returned).catch((error) => context.logger.error(error));
	} catch (error) {
		context.logger.error(error);
	}
}
/** Framework error with a stable machine-readable code. */
var CordisError = class CordisError extends Error {
	code;
	/**
	* @param code — the stable error code; also the default message.
	* @param message — optional human-readable override.
	*/
	constructor(code, message) {
		super(message ?? CordisError.Code[code]);
		this.code = code;
	}
};
/** Cordis error code definitions. */
(function(CordisError) {
	CordisError.Code = { INACTIVE_EFFECT: "cannot create effect on inactive context" };
})(CordisError || (CordisError = {}));
const INACTIVE = "__INACTIVE__";
/**
* Runtime instance of one plugin application.
*
* A fiber tracks dependency state, validated config, lifecycle effects, and
* cleanup for the plugin context returned by `ctx.plugin()`.
*/
var Fiber = class {
	parent;
	inject;
	runtime;
	/** Unique id within the registry; 0 for the root fiber, `null` once disposed. */
	uid;
	/** The context this fiber's plugin runs in (extends the parent context). */
	ctx;
	/** The validated plugin config (updated by `update()`). */
	config;
	/** The raw plugin config, re-resolved before each activation. */
	_config;
	/** Current lifecycle state; transitions emit `internal/status`. */
	state = 0;
	/** Dispose this fiber: unload the plugin, then settle once cleanup finished. */
	dispose;
	/** Snapshot of required service implementations while loaded; `undefined` otherwise. */
	store;
	/** The in-flight load/unload transition, if one is currently running. */
	inertia;
	_hooks = Object.create(null);
	_disposables = new DisposableList();
	context;
	_error;
	_runner;
	_store = Object.create(null);
	/**
	* Create a fiber. Plugin authors normally obtain fibers from `ctx.plugin()`
	* rather than constructing them directly.
	*
	* @param parent — the context the plugin was loaded from.
	* @param config — raw config, validated against the runtime's schema.
	* @param inject — resolved dependency map (service name → intercept config).
	* @param runtime — the shared plugin runtime, or `null` for the root fiber.
	* @param getOuterStack — captures the caller stack for effect diagnostics.
	*/
	constructor(parent, config, inject, runtime, getOuterStack) {
		this.parent = parent;
		this.inject = inject;
		this.runtime = runtime;
		this._config = config;
		const collect = (dispose) => {
			this._disposables.push(dispose);
		};
		if (runtime) {
			this.uid = parent.registry.counter;
			this.ctx = this.context = parent.extend({ fiber: this });
			const injectEntries = Object.entries(this.inject);
			if (injectEntries.length) {
				this.ctx[Context.intercept] = Object.create(parent[Context.intercept]);
				for (const [name, config] of injectEntries) {
					if (isNullable(config)) continue;
					this.ctx[Context.intercept][name] = config;
				}
			}
			this._runner = {
				epoch: INACTIVE,
				getOuterStack,
				execute: function() {
					if (isConstructor(runtime.callback)) {
						const instance = new runtime.callback(this.ctx, this.config);
						for (const hook of instance?.[symbols.initHooks] ?? []) hook();
						return instance?.[symbols.init]?.();
					} else return runtime.callback(this.ctx, this.config);
				},
				collect
			};
			this.dispose = parent.fiber.effect(() => {
				const remove = runtime.fibers.push(this);
				return async () => {
					this.uid = null;
					emitPluginDisposed(this.context, this);
					if (this.ctx.registry.has(runtime.callback)) {
						remove();
						if (!runtime.fibers.length) this.ctx.registry.delete(runtime.callback);
					}
					this._setEpoch(INACTIVE);
					if (!this.inertia) this._updateState(() => {
						this.inertia = this._unload();
						return 5;
					});
					while (this.inertia) await this.inertia;
				};
			}, "ctx.plugin()");
			try {
				this.context.emit("internal/plugin", this);
			} catch (error) {
				Promise.resolve(this.dispose()).catch((reason) => this.ctx.logger.error(reason));
				throw error;
			}
			if (this.uid !== null && parent.fiber.state !== 5) {
				for (const name of Object.keys(this.inject)) this._checkImpl(name);
				this._refresh();
			}
		} else {
			this.uid = 0;
			this.ctx = this.context = parent;
			this.state = 2;
			this.store = Object.create(null);
			this._runner = {
				epoch: "",
				getOuterStack,
				execute: () => {},
				collect
			};
			this.dispose = () => this.restart();
		}
	}
	/** The plugin's display name, inherited from the nearest named ancestor, else `'root'`. */
	get name() {
		let fiber = this;
		do {
			if (fiber.runtime?.name) return fiber.runtime.name;
			fiber = fiber.parent.fiber;
		} while (fiber !== fiber.parent.fiber);
		return "root";
	}
	/**
	* Throw if the fiber has already been disposed.
	*
	* @returns nothing when the fiber is still active.
	* @throws {CordisError} `INACTIVE_EFFECT` when the fiber's uid has been cleared.
	*/
	assertActive() {
		if (this.uid !== null) return;
		throw new CordisError("INACTIVE_EFFECT");
	}
	_execute(runner) {
		const oldEpoch = runner.epoch;
		return composeError((info) => {
			const safeCollect = (dispose) => {
				if (typeof dispose === "function") runner.collect(dispose);
				else if (!isNullable(dispose)) throw new TypeError("Invalid effect");
			};
			const effect = runner.execute.call(this);
			if (typeof effect === "function") return runner.collect(effect);
			else if (isNullable(effect)) {} else if (!isObject(effect)) throw new TypeError("Invalid effect");
			else if ("then" in effect) return effect.then(safeCollect);
			else if (Symbol.iterator in effect) {
				info.error = /* @__PURE__ */ new Error();
				const iter = effect[Symbol.iterator]();
				while (true) {
					const result = iter.next();
					safeCollect(result.value);
					if (result.done) return;
				}
			} else if (Symbol.asyncIterator in effect) {
				const iter = effect[Symbol.asyncIterator]();
				return (async () => {
					await Promise.resolve();
					info.error = /* @__PURE__ */ new Error();
					while (true) {
						if (runner.epoch !== oldEpoch) return;
						const result = await iter.next();
						safeCollect(result.value);
						if (result.done) return;
					}
				})();
			} else throw new TypeError("Invalid effect");
		}, runner.getOuterStack);
	}
	effect(execute, label = "anonymous") {
		this.assertActive();
		if (this.state === 5) throw new CordisError("INACTIVE_EFFECT");
		const disposables = [];
		let disposing = false;
		let disposalTask;
		const dispose = () => {
			if (disposing) return disposalTask;
			disposing = true;
			let task;
			for (const disposable of disposables.splice(0).reverse()) if (task) task = task.then(() => runDisposable(disposable));
			else {
				const result = runDisposable(disposable);
				if (isObject(result) && "then" in result) task = result;
			}
			return disposalTask = task;
		};
		const meta = {
			label,
			children: []
		};
		const runner = {
			execute,
			epoch: true,
			collect: (dispose) => {
				disposables.push(dispose);
				this._disposables.delete(dispose);
				if (dispose[symbols.effect]) meta.children.push(dispose[symbols.effect]);
			},
			getOuterStack: buildOuterStack()
		};
		let task;
		let executing = true;
		let resolveSetup;
		let rejectSetup;
		let setupBarrier;
		let setupFailed = false;
		let inFlight;
		let removeWrapper = () => false;
		const waitForSetup = () => {
			setupBarrier ??= new Promise((resolve, reject) => {
				resolveSetup = resolve;
				rejectSetup = reject;
			});
			return setupBarrier;
		};
		const disposeAfter = (setup) => {
			return Promise.resolve(setup).then(() => dispose(), async (reason) => {
				await dispose();
				throw reason;
			});
		};
		const finalizeDisposal = (callback) => {
			let result;
			try {
				result = callback();
			} catch (error) {
				removeWrapper();
				throw error;
			}
			if (isObject(result) && "then" in result) {
				const pending = Promise.resolve(result).finally(() => {
					removeWrapper();
					if (inFlight === pending) inFlight = void 0;
				});
				return inFlight = pending;
			}
			removeWrapper();
			return result;
		};
		const wrapper = defineProperty(() => {
			if (!runner.epoch) return setupFailed ? inFlight : void 0;
			runner.epoch = false;
			return finalizeDisposal(() => {
				if (executing) return disposeAfter(waitForSetup());
				return task ? disposeAfter(task) : dispose();
			});
		}, symbols.effect, meta);
		effectInertia.set(wrapper, () => inFlight);
		removeWrapper = this._disposables.push(wrapper);
		try {
			task = this._execute(runner);
		} catch (reason) {
			executing = false;
			setupFailed = true;
			runner.epoch = false;
			let cleanup;
			try {
				cleanup = finalizeDisposal(dispose);
			} finally {
				rejectSetup?.(reason);
			}
			if (isObject(cleanup) && "then" in cleanup) cleanup.catch((error) => this.ctx.logger.error(error));
			throw reason;
		}
		executing = false;
		if (setupBarrier) Promise.resolve(task).then(resolveSetup, rejectSetup);
		task?.catch(() => {
			if (!runner.epoch) return dispose();
			return finalizeDisposal(dispose);
		}).catch((error) => this.ctx.logger.error(error));
		const disposeAsync = () => {
			if (!runner.epoch) return;
			runner.epoch = false;
			return finalizeDisposal(dispose);
		};
		wrapper.then = async (onFulfilled, onRejected) => {
			return Promise.resolve(task).then(() => disposeAsync).then(onFulfilled, onRejected);
		};
		return wrapper;
	}
	/**
	* Return metadata for currently registered effects.
	*
	* @returns one {@link EffectMeta} tree per labeled live effect.
	*/
	getEffects() {
		return [...this._disposables].map((dispose) => dispose[symbols.effect]).filter(Boolean);
	}
	_getState() {
		if (this.uid === null) return 4;
		if (this._error) return 3;
		if (this._runner.epoch !== INACTIVE) return 2;
		return 0;
	}
	_updateState(callback) {
		const oldState = this.state;
		this.state = callback() ?? this._getState();
		if (oldState === this.state) return;
		this.context.emit("internal/status", this, oldState);
		if (oldState !== 2 && this.state !== 2) return;
		for (const key of Reflect.ownKeys(this.ctx.reflect.store)) {
			const impl = this.ctx.reflect.store[key];
			if (impl.fiber !== this) continue;
			this.ctx.reflect.notify([impl.name]);
		}
	}
	_checkImpl(name) {
		const impl = this.ctx.reflect._getImpl(name, true);
		if (!impl) return delete this._store[name];
		try {
			if (impl.check && !impl.check.call(getTraceable(this.ctx, impl.value))) return delete this._store[name];
		} catch (error) {
			impl.fiber.ctx.logger.error(error);
			return delete this._store[name];
		}
		this._store[name] = impl;
	}
	_refresh() {
		let epoch = false;
		epoch = "";
		for (const name of Object.keys(this.inject)) {
			const impl = this._store[name];
			if (!impl) {
				epoch = INACTIVE;
				break;
			}
			epoch += ":" + impl.fiber.uid;
		}
		this._setEpoch(epoch);
	}
	_setEpoch(epoch) {
		const oldEpoch = this._runner.epoch;
		if (epoch === oldEpoch) return;
		this._runner.epoch = epoch;
		if (this.inertia) return;
		this._updateState(() => {
			if (epoch !== INACTIVE && oldEpoch === INACTIVE) {
				this.inertia = this._reload();
				return 1;
			} else {
				this.inertia = this._unload();
				return 5;
			}
		});
	}
	_resolveConfig(config) {
		config = this.context.waterfall(this, "internal/config", config, () => config);
		return this.runtime ? resolveConfig(this.runtime, config) : config;
	}
	async _reload() {
		this.store = { ...this._store };
		const oldEpoch = this._runner.epoch;
		try {
			await Promise.resolve();
			if (this._runner.epoch === oldEpoch) {
				this.config = this._resolveConfig(this._config);
				await this._execute(this._runner);
				this._error = void 0;
			}
		} catch (reason) {
			this.ctx.logger.error(reason);
			this._error = reason;
			this._runner.epoch = INACTIVE;
		}
		this._updateState(() => {
			if (this._runner.epoch === oldEpoch) this.inertia = void 0;
			else {
				this.inertia = this._unload();
				return 5;
			}
		});
	}
	async _unload() {
		await Promise.all(this._disposables.clear().map(async (dispose) => {
			try {
				await composeError(async (info) => {
					await Promise.resolve();
					info.error = /* @__PURE__ */ new Error();
					await runDisposable(dispose);
				}, this._runner.getOuterStack);
			} catch (reason) {
				this.ctx.logger.error(reason);
			}
		}));
		this.store = void 0;
		this._updateState(() => {
			if (this._runner.epoch === INACTIVE) this.inertia = void 0;
			else {
				this.inertia = this._reload();
				return 1;
			}
		});
	}
	/**
	* Wait for current lifecycle work and rethrow startup errors.
	*
	* @returns this fiber, once it has settled into a stable state.
	* @throws the config-validation or plugin-startup error, if any.
	*/
	async await() {
		while (this.inertia) await this.inertia;
		if (this._error) throw this._error;
		return this;
	}
	/**
	* Dispose and immediately reload this plugin with its current config.
	*
	* @returns a promise resolving once the reload settled.
	* @throws {CordisError} `INACTIVE_EFFECT` when the fiber is already disposed.
	*/
	async restart() {
		this.assertActive();
		this._setEpoch(INACTIVE);
		this._refresh();
		await this.await();
	}
	/**
	* Validate and apply new config, then restart the plugin.
	*
	* Runs the `internal/update` waterfall first, so update hooks (and HMR)
	* can veto or replace the restart.
	*
	* @param config — the new raw config; validated before anything restarts.
	* @param noSave — hint for persistence hooks not to write the change back.
	* @returns the update waterfall result; the default restart returns a promise.
	* @throws when validation, an update listener, or the restarted plugin fails.
	*/
	update(config, noSave = false) {
		this.assertActive();
		this._config = config;
		if (this.state !== 2) {
			this._error = void 0;
			this._setEpoch(INACTIVE);
			this._refresh();
			return;
		}
		config = this._resolveConfig(config);
		return this.context.waterfall(this, "internal/update", config, noSave, () => {
			this.config = config;
			this._error = void 0;
			return this.restart();
		});
	}
};
function isApplicable(object) {
	return object && typeof object === "object" && typeof object.apply === "function";
}
/**
* Decorator for declaring service dependencies on classes or class methods.
*
* On classes it contributes to the plugin's static `inject` map. On methods it
* delays the method call until the declared services are available.
*/
/**
* @param name — the required service name.
* @param config — optional intercept config applied for that service.
* @returns the class or method decorator.
*/
function Inject(name, config) {
	return function(value, decorator) {
		if (decorator.kind === "class") {
			if (!Object.hasOwn(value, "inject")) {
				defineProperty(value, "inject", Object.create(Object.getPrototypeOf(value).inject ?? null));
				defineProperty(value.inject, symbols.checkProto, true);
			}
			value.inject[name] = config;
		} else if (decorator.kind === "method") {
			const inject = (value[symbols.metadata] ??= {}).inject ??= Object.create(null);
			inject[name] = config;
			decorator.addInitializer(function() {
				const property = this[symbols.tracker]?.property;
				(this[symbols.initHooks] ??= []).push(() => {
					this.ctx.inject(inject, (ctx) => {
						return value.call(property ? withProps(this, { [property]: ctx }) : this);
					});
				});
			});
		} else throw new Error("@Inject() can only be used on class or class methods");
	};
}
/** Utilities for normalizing plugin dependency declarations. */
(function(Inject) {
	/**
	* Convert array/object/class-inherited inject metadata into a plain map.
	*
	* @param inject — the declaration to normalize; `null`/`undefined` add nothing.
	* @param result — the map to fill (service name → intercept config or `null`).
	* @returns `result`.
	*/
	function resolve(inject, result = Object.create(null)) {
		if (!inject) return result;
		if (Array.isArray(inject)) for (const name of inject) result[name] = null;
		else if (Reflect.has(inject, symbols.checkProto)) {
			Object.assign(result, resolve(Object.getPrototypeOf(inject)));
			for (const name of Object.keys(inject)) result[name] = inject[name] ?? null;
		} else for (const name of Object.keys(inject)) result[name] = inject[name] ?? null;
		return result;
	}
	Inject.resolve = resolve;
})(Inject || (Inject = {}));
/**
* Plugin registry installed as `ctx.registry` and mixed into every context.
*
* It normalizes plugin shapes, tracks plugin runtimes, starts fibers, and
* exposes map-like inspection over active plugin callbacks.
*/
var RegistryService = class {
	ctx;
	_counter = 0;
	_internal = /* @__PURE__ */ new Map();
	constructor(ctx) {
		this.ctx = ctx;
		defineProperty(this, symbols.tracker, {
			property: "ctx",
			noShadow: true
		});
	}
	/** Allocate the next fiber uid (increments on every read). */
	get counter() {
		return ++this._counter;
	}
	/** Number of registered plugin runtimes. */
	get size() {
		return this._internal.size;
	}
	/**
	* Resolve a supported plugin shape to its executable callback.
	*
	* @param plugin — a function, class, or `{ apply }` object plugin.
	* @returns the callback identifying the plugin, or `undefined` if invalid.
	*/
	resolve(plugin) {
		try {
			if (typeof plugin === "function") return plugin;
			if (isApplicable(plugin)) return plugin.apply;
		} catch {}
	}
	/**
	* Look up the runtime record for a plugin.
	*
	* @param plugin — any supported plugin shape.
	* @returns the runtime, or `undefined` when the plugin is not registered.
	*/
	get(plugin) {
		const key = this.resolve(plugin);
		return key && this._internal.get(key);
	}
	/**
	* Check whether a plugin has a registered runtime.
	*
	* @param plugin — any supported plugin shape.
	* @returns `true` when at least one fiber of the plugin exists.
	*/
	has(plugin) {
		const key = this.resolve(plugin);
		return !!key && this._internal.has(key);
	}
	/**
	* Dispose every running fiber for a plugin and remove its runtime record.
	*
	* @param plugin — any supported plugin shape.
	* @returns the removed runtime, or `undefined` when none was registered.
	*/
	delete(plugin) {
		const key = this.resolve(plugin);
		const runtime = key && this._internal.get(key);
		if (!runtime) return;
		this._internal.delete(key);
		for (const fiber of runtime.fibers) fiber.dispose();
		return runtime;
	}
	/** Iterate the registered plugin callbacks. */
	keys() {
		return this._internal.keys();
	}
	/** Iterate the registered plugin runtimes. */
	values() {
		return this._internal.values();
	}
	/** Iterate `[callback, runtime]` pairs. */
	entries() {
		return this._internal.entries();
	}
	/**
	* Visit every registered runtime.
	*
	* @param callback — receives each runtime and its identifying callback.
	*/
	forEach(callback) {
		return this._internal.forEach(callback);
	}
	/**
	* Start a callback once the requested dependencies are available.
	*
	* @param inject — required services, as an array or a name → config map.
	* @param callback — plugin body called with `(ctx, config)`.
	* @returns the fiber; awaiting it settles once loading finished.
	*/
	inject(inject, callback) {
		return this.plugin({
			inject,
			apply: callback,
			name: callback.name
		});
	}
	/**
	* Start a plugin in the current context and return its fiber.
	*
	* Creates (or reuses) the plugin's runtime record, then starts a new fiber
	* under the current context. Throws if `plugin` is not a supported shape or
	* if the current fiber is already disposed.
	*
	* @param plugin — a function, class, or `{ apply }` object plugin.
	* @param config — the plugin config, validated against its `Config` schema.
	* @param getOuterStack — captures the caller stack for effect diagnostics.
	* @returns the fiber; awaiting it settles once loading finished.
	*/
	plugin(plugin, config, getOuterStack = buildOuterStack()) {
		const callback = this.resolve(plugin);
		if (!callback) throw new Error("invalid plugin, expect function or object with an \"apply\" method, received " + typeof plugin);
		this.ctx.fiber.assertActive();
		let runtime = this._internal.get(callback);
		if (!runtime) {
			let name = plugin.name;
			if (name === "apply") name = void 0;
			runtime = {
				name,
				callback,
				fibers: new DisposableList(),
				Config: plugin.Config
			};
			this._internal.set(callback, runtime);
		}
		const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack);
		const wrapped = Object.create(fiber);
		wrapped.then = (onFulfilled, onRejected) => {
			return fiber.await().then(onFulfilled, onRejected);
		};
		return wrapped;
	}
};
/**
* Root and child dependency containers for Cordis plugins.
*
* A context is a proxy: normal property reads go through the service resolver,
* while `extend()`, `isolate()`, and `intercept()` create scoped child
* contexts without mutating their parent.
*/
var Context = class Context {
	/** Symbol key under which a disposer exposes its {@link EffectMeta} diagnostics tree. */
	static effect = symbols.effect;
	/** Symbol key for a context's listener filter, consulted on every event dispatch. */
	static filter = symbols.filter;
	/** Symbol key of the isolation map (see the `Context[symbols.isolate]` property). */
	static isolate = symbols.isolate;
	/** Symbol key of the intercept map (see the `Context[symbols.intercept]` property). */
	static intercept = symbols.intercept;
	/**
	* Returns true for Cordis context proxies and context prototypes.
	*
	* Works across realms and across multiple copies of cordis, because the
	* brand is keyed by a global symbol rather than by `instanceof`.
	*
	* @param value — the value to test.
	* @returns `true` if `value` is a Cordis context, narrowing its type.
	*/
	static is(value) {
		return !!value?.[Context.is];
	}
	static {
		Context.is[Symbol.toPrimitive] = () => Symbol.for("cordis.is");
		Context.prototype[Context.is] = true;
	}
	/** Create the root context and install the built-in services. */
	constructor() {
		this[symbols.isolate] = Object.create(null);
		this[symbols.intercept] = Object.create(null);
		const self = new Proxy(this, ReflectService.handler);
		this.root = self;
		this.baseUrl = void 0;
		this.fiber = new Fiber(self, {}, Object.create(null), null, () => []);
		this.reflect = new ReflectService(self);
		this.registry = new RegistryService(self);
		this.events = new EventsService(self);
		this.logger = new LoggerService(self);
		this.fiber._disposables.clear();
		return self;
	}
	[Symbol.for("nodejs.util.inspect.custom")]() {
		return `Context <${this.fiber.name}>`;
	}
	/**
	* Create a child context with extra metadata on top of the current scope.
	*
	* The child prototypally inherits every property of this context; own
	* properties of `meta` shadow the inherited ones. The parent is not mutated.
	*
	* @param meta — own properties (including symbol keys) to define on the child.
	* @returns a child context inheriting from this one.
	*/
	extend(meta = {}) {
		const shadow = Reflect.getOwnPropertyDescriptor(this, symbols.shadow)?.value;
		const self = Object.create(getTraceable(this, this));
		for (const prop of Reflect.ownKeys(meta)) Object.defineProperty(self, prop, Reflect.getOwnPropertyDescriptor(meta, prop));
		if (!shadow) return self;
		return Object.assign(Object.create(self), { [symbols.shadow]: shadow });
	}
	/**
	* Create a child context with an independent service scope for `name`.
	*
	* Below the returned context, reads and writes of the service `name`
	* resolve against the new label instead of the parent's, so a different
	* implementation can be provided without affecting the parent scope.
	* Passing the same `label` to two `isolate()` calls joins their scopes.
	*
	* @param name — the service name to isolate.
	* @param label — scope label to join; defaults to a fresh unique symbol.
	* @returns a child context whose `name` service resolves in the new scope.
	*/
	isolate(name, label) {
		const shadow = Object.create(this[symbols.isolate]);
		shadow[name] = label ?? Symbol(name);
		return this.extend({ [symbols.isolate]: shadow });
	}
	intercept(name, config) {
		const intercept = Object.create(this[symbols.intercept]);
		intercept[name] = config;
		return this.extend({ [symbols.intercept]: intercept });
	}
};
/**
* Base class for services that expose a named API on `ctx`.
*
* Subclasses call `super(ctx, name)` from their constructor. The service is
* registered immediately and is automatically removed with the owning fiber.
*/
var Service = class Service {
	ctx;
	/** Symbol key of an instance method run after construction (class plugins). */
	static init = symbols.init;
	/** Symbol key of the availability predicate passed to `ctx.provide()`. */
	static check = symbols.check;
	/** Symbol key of the phantom intercept-config type parameter. */
	static config = symbols.config;
	/** Symbol key of the call body making a service callable (e.g. `ctx.logger()`). */
	static invoke = symbols.invoke;
	/** Symbol key of the helper deriving an extended service instance. */
	static extend = symbols.extend;
	/** Symbol key of the tracker metadata used for context tracing. */
	static tracker = symbols.tracker;
	/** Symbol key of the intercept-config resolution helper below. */
	static resolveConfig = symbols.resolveConfig;
	/** The service name this instance is registered under. */
	name;
	/**
	* Register this instance as `name` in the current context.
	*
	* Calls `ctx.reflect.provide(name, this, this[Service.check])`, so the
	* service is unregistered automatically when the owning fiber unloads.
	* Services with a `[Service.invoke]` body return a callable instance.
	*
	* @param ctx — the context to register in (stored as `this.ctx`).
	* @param name — the service name; defaults to the static `provide` field.
	*/
	constructor(ctx, name) {
		this.ctx = ctx;
		name ??= this.constructor["provide"];
		let self = this;
		const tracker = {
			associate: name,
			property: "ctx"
		};
		if (self[symbols.invoke]) self = createCallable(name, joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
		self.ctx = ctx;
		self.name = name;
		defineProperty(self, symbols.tracker, tracker);
		self.ctx.reflect.provide(name, self, this[symbols.check]);
		return self;
	}
	[symbols.filter](ctx) {
		return ctx[symbols.isolate][this.name] === this.ctx[symbols.isolate][this.name];
	}
	[symbols.extend](props) {
		let self;
		if (this[Service.invoke]) self = createCallable(this.name, this, this[symbols.tracker]);
		else self = Object.create(this);
		return Object.assign(self, props);
	}
	/**
	* Merge intercept config from ancestors with optional base and head values.
	*
	* Entries added closer to the root apply first; `base` is prepended and
	* `head` appended. Uses `Config.merge` when the service declares one,
	* otherwise a shallow `Object.assign`.
	*
	* @param base — lowest-precedence config merged before all intercepts.
	* @param head — highest-precedence config merged after all intercepts.
	* @returns the merged config.
	*/
	[symbols.resolveConfig](base, head) {
		let intercept = this.ctx[Context.intercept];
		const configs = [];
		while (this.name in intercept) {
			if (Object.hasOwn(intercept, this.name)) configs.unshift(intercept[this.name]);
			intercept = Object.getPrototypeOf(intercept);
		}
		if (base) configs.unshift(base);
		if (head) configs.push(head);
		if (this["Config"]?.merge) return this["Config"].merge(...configs);
		else return Object.assign({}, ...configs);
	}
	static [Symbol.hasInstance](instance) {
		if (!instance) return false;
		let constructor = instance.constructor;
		while (constructor) {
			constructor = constructor.prototype?.constructor;
			if (constructor === this) return true;
			constructor &&= Object.getPrototypeOf(constructor);
		}
		return false;
	}
};
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/schemastery/lib/index.mjs
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers = {};
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject$1(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject$1(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject$1(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/dsh-scope/lib/index.js
/**
* Shared insertion-ordered storage and effect ownership for scope-aware registries.
*
* @module @deepseek-ai/dsh-scope
*/
/**
* Insertion-ordered named entries with caller-owned duplicate diagnostics.
*
* Values are borrowed. Iterators are live within one nonempty table
* generation; draining the table detaches them from later insertions. Each
* successful insertion returns an idempotent undo for that exact entry.
*/
var NamedEntries = class {
	duplicateError;
	data = /* @__PURE__ */ new Map();
	constructor(duplicateError) {
		this.duplicateError = duplicateError;
	}
	/**
	* Insert one unique name.
	* @param name - name unique within this table.
	* @param value - borrowed value to retain.
	* @returns an idempotent undo that removes only this insertion.
	*/
	insert(name, value) {
		const data = this.data;
		if (data.has(name)) throw this.duplicateError(name);
		data.set(name, value);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			data.delete(name);
			if (data.size === 0 && this.data === data) this.data = /* @__PURE__ */ new Map();
		};
	}
	/**
	* Read one named value.
	* @param name - name to resolve.
	* @returns the retained value, or `undefined` when absent.
	*/
	get(name) {
		return this.data.get(name);
	}
	/**
	* Test one name for membership.
	* @param name - name to test.
	* @returns whether the table contains that name.
	*/
	has(name) {
		return this.data.has(name);
	}
	/**
	* Iterate live names in insertion order.
	* @returns the native live key iterator.
	*/
	keys() {
		return this.data.keys();
	}
	/**
	* Iterate live entries in insertion order.
	* @returns the native live entry iterator.
	*/
	entries() {
		return this.data.entries();
	}
	/**
	* Iterate live values in insertion order.
	* @returns the native live value iterator.
	*/
	values() {
		return this.data.values();
	}
	/**
	* Test whether this table has no entries.
	* @returns whether the table is empty.
	*/
	isEmpty() {
		return this.data.size === 0;
	}
};
/**
* Insertion-ordered anonymous entries with independent registration identity.
*
* Equal values remain separate registrations. Values are borrowed, and
* iterators are live within one nonempty table generation; draining the table
* detaches them from later appends.
*/
var AnonymousEntries = class {
	data = /* @__PURE__ */ new Map();
	/**
	* Append one independently owned value.
	* @param value - borrowed value to retain.
	* @returns an idempotent undo for this exact append.
	*/
	append(value) {
		const data = this.data;
		const key = Symbol();
		data.set(key, value);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			data.delete(key);
			if (data.size === 0 && this.data === data) this.data = /* @__PURE__ */ new Map();
		};
	}
	/**
	* Iterate live values in insertion order.
	* @returns the native live value iterator.
	*/
	values() {
		return this.data.values();
	}
	/**
	* Test whether this table has no entries.
	* @returns whether the table is empty.
	*/
	isEmpty() {
		return this.data.size === 0;
	}
};
/**
* Own the global and exact-scope layers for one registry.
*
* Reads never create scoped layers. Registrations derive both visibility and
* effect ownership from the supplied Cordis context, collect undo before
* notification, and reclaim only a completely empty aggregate layer.
*/
var ScopedLayers = class {
	createLayer;
	onChange;
	/** The eagerly constructed context-global layer. */
	global;
	scoped = /* @__PURE__ */ new Map();
	constructor(createLayer, onChange) {
		this.createLayer = createLayer;
		this.onChange = onChange;
		this.global = createLayer(void 0);
	}
	/**
	* Read an existing exact-scope overlay. Deliberately chain-blind: callers
	* addressing one scope's OWN contributions (its restrictions, its guards)
	* must not silently pick up an ancestor's — use {@link chainLayers} where
	* inheritance is the point.
	* @param scope - exact scope key; `undefined` denotes no overlay.
	* @returns the existing scoped layer, or `undefined` without creating one.
	*/
	peek(scope) {
		if (scope === void 0) return void 0;
		return this.scoped.get(scope);
	}
	/**
	* Existing overlays along the scope's parent chain ({@link scopeChainOf}),
	* farthest ancestor first and the exact scope last, so a caller layering
	* them in order gives the nearest scope the final word.
	* @param scope - viewing scope, or `undefined` for no overlays.
	* @returns the existing layers, nearest last; absent overlays are skipped.
	*/
	chainLayers(scope) {
		const layers = [];
		for (const key of scopeChainOf(scope).reverse()) {
			const layer = this.scoped.get(key);
			if (layer !== void 0) layers.push(layer);
		}
		return layers;
	}
	/**
	* Materialize global named entries followed by scope-chain shadows,
	* farthest ancestor first, so the nearest scope's entry wins a name.
	* @param scope - viewing scope, or `undefined` for the global view.
	* @param pick - select the named table from a layer.
	* @returns an insertion-ordered effective map.
	*/
	merge(scope, pick) {
		const merged = new Map(pick(this.global).entries());
		for (const layer of this.chainLayers(scope)) for (const [name, value] of pick(layer).entries()) merged.set(name, value);
		return merged;
	}
	/**
	* Attach one synchronous layer mutation to its registration context.
	* @param ctx - context that determines both scope visibility and effect ownership.
	* @param action - atomic mutation returning its synchronous undo.
	* @param options - Cordis effect label and optional change notification.
	* @returns the exact disposer returned by `ctx.effect()`.
	*/
	effect(ctx, action, options) {
		const scope = scopeOf(ctx);
		const notify = options.notify ?? true;
		return ctx.effect(function* () {
			let layer;
			let created = false;
			if (scope === void 0) layer = this.global;
			else {
				const existing = this.scoped.get(scope);
				if (existing === void 0) {
					layer = this.createLayer(scope);
					this.scoped.set(scope, layer);
					created = true;
				} else layer = existing;
			}
			let undo;
			try {
				undo = action(layer);
			} catch (error) {
				if (scope !== void 0 && created && layer.isEmpty()) this.scoped.delete(scope);
				throw error;
			}
			yield () => {
				undo();
				if (scope !== void 0 && layer.isEmpty()) this.scoped.delete(scope);
				if (notify) this.onChange();
			};
			if (notify) this.onChange();
		}.bind(this), options.label);
	}
};
/**
* Scoped-context primitive: mint a Cordis context that tags registrations with
* an opaque identity and build routing-only event carriers for that identity.
*
* @module @deepseek-ai/dsh-scope
*/
/** Context tag written by {@link createScope}. */
const kScope = Symbol("dsh.scope");
/** The key associated with each carrier. Presence distinguishes an unkeyed carrier from a non-carrier. */
const carrierKeys = /* @__PURE__ */ new WeakMap();
/**
* The enclosing scope of each key. One relation powers both directions of
* scope nesting: registration views inherit DOWN the chain (a child scope
* sees its ancestors' layers — {@link ScopedLayers}), and event admission
* extends UP it (a listener tagged with an ancestor receives events dispatched
* to a descendant key — {@link scopeTarget}).
*/
const scopeParents = /* @__PURE__ */ new WeakMap();
/**
* The chain from a key to its root ancestor.
* @param key - the starting key, or `undefined` for the empty chain.
* @returns keys nearest-first: `[key, parent, grandparent, …]`.
*/
function scopeChainOf(key) {
	const chain = [];
	for (let cursor = key; cursor !== void 0; cursor = scopeParents.get(cursor)) chain.push(cursor);
	return chain;
}
/**
* Read the nearest scope tag inherited by a context.
* @param ctx - context to inspect.
* @returns its scope key, or `undefined` for an unscoped context.
*/
function scopeOf(ctx) {
	return ctx[kScope];
}
/**
* Build an opaque receiver that preserves the base filter, admits untagged
* listeners globally, and admits tagged listeners for a matching key or any
* of its ancestors ({@link bindScopeParent}): a listener owned by an enclosing
* scope receives every descendant scope's events, which is what lets one
* standing composition observe each of the agents composed under it. A tag
* BELOW the dispatch key stays excluded — events flow up the chain, never
* down.
* @param base - subject or service whose existing Cordis filter is preserved.
* @param key - routed scope identity, or `undefined` for an unscoped subject.
* @returns a carrier whose subject remains available only through event arguments.
*/
function scopeTarget(base, key) {
	const baseFilter = base[Context.filter];
	const carrier = { [Context.filter](ctx) {
		if (baseFilter !== void 0 && !baseFilter.call(base, ctx)) return false;
		const tag = scopeOf(ctx);
		if (tag === void 0) return true;
		for (let cursor = key; cursor !== void 0; cursor = scopeParents.get(cursor)) if (cursor === tag) return true;
		return false;
	} };
	carrierKeys.set(carrier, key);
	return carrier;
}
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js
/**
* Remote decorators and explicit Gateway bindings backed only by private
* module state. Strict reflection remains a Typert compiler responsibility.
* @module @deepseek-ai/dsh-typert-protocol
*/
const TYPERT_REMOTE_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;
/**
* Test one generated Remote name against the Connection endpoint grammar.
* @param value - namespace, method, lookup, or Context segment.
* @returns whether the value can cross the shared RPC carrier unchanged.
*/
function isTypertRemoteSegment(value) {
	return value !== "." && value !== ".." && TYPERT_REMOTE_SEGMENT_PATTERN.test(value);
}
/** A business Remote rejection preserved by unary and stream carriers. */
var TypertRemoteFailure = class extends Error {
	/** Stable caller-facing failure payload. */
	failure;
	/**
	* Wrap one business rejection for transport without changing its code or details.
	* @param failure - business failure returned unchanged to the caller.
	*/
	constructor(failure) {
		super(failure.message);
		this.name = "TypertRemoteFailure";
		this.failure = failure;
	}
};
const markers = /* @__PURE__ */ new WeakMap();
/**
* Bind one visible Service field to a Cordis key and Remote namespace.
* @param service - owning Service instance, normally `this`.
* @param serviceKey - exact Cordis service key.
* @param options - optional distinct wire namespace.
* @returns a frozen, inspectable binding with no compiler-injected metadata.
*/
function bindTypertRemote(service, serviceKey, options = {}) {
	validateName("service key", serviceKey);
	const namespace = options.namespace ?? serviceKey;
	validateName("namespace", namespace);
	return Object.freeze({
		service,
		serviceKey,
		namespace
	});
}
/** Cordis Service base that exposes its registered name through Typert Gateway. */
var TypertRemoteService = class extends Service {
	/** Visible binding consumed by the Gateway's source-mode discovery. */
	typertRemote;
	/**
	* Register the Service and bind the same key to Typert Gateway.
	* @param ctx - owning Cordis Context.
	* @param serviceKey - exact Cordis service key and default wire namespace.
	* @param options - optional distinct wire namespace.
	*/
	constructor(ctx, serviceKey, options = {}) {
		super(ctx, serviceKey);
		this.typertRemote = bindTypertRemote(this, this.name, options);
	}
};
function Remote(methodExportOrOptions, context) {
	if (typeof methodExportOrOptions === "string") {
		validateName("Remote export name", methodExportOrOptions);
		return remoteDecorator({ kind: "direct" }, void 0, methodExportOrOptions);
	}
	if (typeof methodExportOrOptions === "object") {
		if (remoteOptionMode(methodExportOrOptions) !== "stream" || Reflect.ownKeys(methodExportOrOptions).length !== 1) throw new TypeError("typert-protocol: Remote options must contain exactly mode: \"stream\"");
		return remoteDecorator({ kind: "direct" }, "stream");
	}
	if (context === void 0) throw new TypeError("typert-protocol: Remote decorator context is missing");
	addMarkerInitializer(context, { kind: "direct" });
}
function remoteOptionMode(options) {
	return Reflect.get(options, "mode");
}
function remoteDecorator(invocation, mode, exportName) {
	return function(_method, context) {
		addMarkerInitializer(context, invocation, mode, exportName);
	};
}
function addMarkerInitializer(context, invocation, mode, exportName) {
	if (context.private || context.static || typeof context.name !== "string") throw new TypeError("typert-protocol: Remote decorators require a public instance method with a string name");
	const method = context.name;
	context.addInitializer(function() {
		const prototype = Object.getPrototypeOf(this);
		if (prototype === null) throw new TypeError(`typert-protocol: cannot mark Remote method "${method}" on an object without a prototype`);
		mark(prototype, method, invocation, mode, exportName);
	});
}
function mark(prototype, method, invocation, mode, exportName) {
	let table = markers.get(prototype);
	if (table === void 0) {
		table = /* @__PURE__ */ new Map();
		markers.set(prototype, table);
	}
	const marker = {
		...exportName === void 0 || exportName === method ? {} : { exportName },
		...mode === void 0 ? {} : { mode },
		invocation: Object.freeze(invocation)
	};
	const current = table.get(method);
	if (current !== void 0) {
		if (current.exportName === marker.exportName && current.mode === marker.mode && sameInvocation(current.invocation, invocation)) return;
		throw new Error(`typert-protocol: Remote method "${method}" has conflicting invocation markers`);
	}
	table.set(method, Object.freeze(marker));
}
function sameInvocation(left, right) {
	return left.kind === right.kind && (left.kind === "direct" || right.kind === "context" && left.context === right.context);
}
function validateName(subject, value) {
	if (!isTypertRemoteSegment(value)) throw new TypeError(`typert-protocol: ${subject} must contain only RPC endpoint segment characters`);
}
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/dsh-util-crypto/lib/index.js
/**
* Random v4 UUID, minted from `crypto.getRandomValues`.
* @returns the UUID string.
*/
function randomUUID() {
	const bytes = globalThis.crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16));
	const hex = Array.from(bytes, (byte, index) => {
		return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
	}).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/dsh-timeout/lib/index.js
/** Largest delay Node schedules without clamping it to one millisecond. */
const MAX_TIMER_DELAY_MS = 2147483647;
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/dsh-llm/lib/index.js
/**
* dsh-llm's owned branded ids: tool-call correlation and provider request
* diagnostics.
*
* The `Branded<B>` primitive itself lives in `@deepseek-ai/dsh-brand` (a
* zero-dependency type-only package) so every owner of a cross-boundary id can
* brand it without depending on dsh-llm; see that package's README for the
* nominal-typing policy.
*
* @module @deepseek-ai/dsh-llm/brand
*/
/**
* Brand a message identifier.
* @param id - the opaque message identifier.
* @returns the same string, branded; no validation is performed.
*/
function MessageId(id) {
	return id;
}
/**
* Brand a string as a {@link ToolCallId}.
* @param id - the provider-issued (or synthesized) call id.
* @returns the same string, branded; no validation is performed.
*/
function ToolCallId(id) {
	return id;
}
/**
* Field-wise equality over {@link LlmCallConfig} — the comparison a caller
* runs to decide whether a proposed configuration is a real change (worth a
* logged header snapshot) or the held one restated.
* @param a - one configuration.
* @param b - the other.
* @returns whether every field (including the `stop` list, element-wise) matches.
*/
function callConfigEquals(a, b) {
	if (a.provider !== b.provider || a.model !== b.model || a.reasoningEffort !== b.reasoningEffort || a.temperature !== b.temperature || a.maxTokens !== b.maxTokens) return false;
	if (a.stop === void 0 || b.stop === void 0) return a.stop === b.stop;
	return a.stop.length === b.stop.length && a.stop.every((s, i) => s === b.stop?.[i]);
}
/**
* Deep-freeze a value in place with an iterative traversal, guarding cycles,
* so later mutation throws without imposing a JavaScript call-stack depth cap.
* {@link AbortSignal} objects are deliberately skipped because they are the
* request's live cancellation channel and freezing them breaks abort.
* @param value - the value to freeze in place.
* @returns the same value, frozen.
*/
function deepFreeze$1(value) {
	const seen = /* @__PURE__ */ new WeakSet();
	const pending = [{
		kind: "visit",
		node: value
	}];
	while (pending.length > 0) {
		const task = pending.pop();
		/* v8 ignore next -- the loop condition guarantees one pending task. */
		if (task === void 0) continue;
		if (task.kind === "property") {
			pending.push({
				kind: "visit",
				node: task.source[task.key]
			});
			continue;
		}
		const node = task.node;
		if (node === null || typeof node !== "object") continue;
		if (node instanceof AbortSignal) continue;
		if (seen.has(node)) continue;
		seen.add(node);
		Object.freeze(node);
		const keys = Object.keys(node);
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) continue;
			pending.push({
				kind: "property",
				source: node,
				key
			});
		}
	}
	return value;
}
/**
* Detach and deep-freeze a message whose identity already exists.
* @param message - complete message, including its stable identity.
* @returns an immutable snapshot that preserves the identity.
*/
function freezeMessage(message) {
	return deepFreeze$1(structuredClone(message));
}
/**
* Create one identified message and freeze it before publication.
* @param input - complete role, content, and source for a new message.
* @returns an immutable message with a fresh stable identity.
*/
function createMessage(input) {
	return freezeMessage({
		...input,
		id: MessageId(randomUUID())
	});
}
/**
* Create one identified user-role message and freeze it before publication.
* @param input - complete content and source for a new user message.
* @returns an immutable user message with a fresh stable identity.
*/
function createUserMessage(input) {
	return createMessage({
		...input,
		role: "user"
	});
}
/**
* Harness error base with a stable machine-routable code and chained cause.
* Package errors extend it so tool results and replay can retain failure class.
* @module @deepseek-ai/dsh-llm/error
*/
/**
* Base class for all harness errors. Carries a `code` (stable, programmatic —
* e.g. `NO_ADAPTER`, `INVALID_ARGS`, `INVARIANT`) distinct from the
* human-readable `message`, and supports `cause` chaining via the standard
* `ErrorOptions`. `name` defaults to the subclass constructor name.
*/
var HarnessError = class extends Error {
	/** Stable machine-routable failure class (e.g. `RATE_LIMIT`); route on this, never by parsing `message`. */
	code;
	constructor(message, code, options) {
		super(message, options);
		this.code = code;
		this.name = new.target.name;
	}
};
/**
* Canonical provider-neutral code for a response that completed normally but
* carried no content blocks at all. Providers occasionally emit a degenerate
* completion (a terminal stop with zero output); adapters classify it as this
* failure instead of yielding an empty assistant message, because an empty
* message silently ends the turn with nothing for the user or the loop to act
* on. The attempt produced nothing durable, so retry policy treats it as safe
* to repeat.
*/
const EMPTY_RESPONSE_CODE = "EMPTY_RESPONSE";
new RegExp(String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]` + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`, "i");
new RegExp(String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?` + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?` + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`, "i");
new RegExp(String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}` + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}` + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`, "i");
/**
* Provider-owned request-retry policy configuration and resolution.
*
* Adapters expose one resolved policy per registered provider route; the
* optional dsh-llm-retry plugin executes it on the agent's failed-step extension point.
*
* @module @deepseek-ai/dsh-llm/retry-policy
*/
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 1e4;
const DEFAULT_JITTER_RATIO = .1;
const DEFAULT_RETRYABLE_CODES = Object.freeze([
	EMPTY_RESPONSE_CODE,
	"RATE_LIMIT",
	"SERVER",
	"TIMEOUT",
	"TRANSPORT"
]);
const backoffSchema = Schema.object({
	initialDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
	maxDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
	jitterRatio: Schema.number().min(0).max(1).default(DEFAULT_JITTER_RATIO)
});
const normalPolicySchema = Schema.object({
	mode: Schema.const("normal").required(),
	maxRetries: Schema.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
	retryableCodes: Schema.array(Schema.string()).default([...DEFAULT_RETRYABLE_CODES]),
	backoff: backoffSchema
});
const alwaysPolicySchema = Schema.object({
	mode: Schema.const("always").required(),
	backoff: backoffSchema
});
Schema.union([normalPolicySchema, alwaysPolicySchema]);
const NORMAL_POLICY_KEYS = /* @__PURE__ */ new Set([
	"mode",
	"maxRetries",
	"retryableCodes",
	"backoff"
]);
const ALWAYS_POLICY_KEYS = /* @__PURE__ */ new Set([
	"mode",
	"maxRetries",
	"retryableCodes",
	"backoff"
]);
const BACKOFF_KEYS = /* @__PURE__ */ new Set([
	"initialDelayMs",
	"maxDelayMs",
	"jitterRatio"
]);
function validateKeys(value, allowed, path) {
	for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${path}: unknown key "${key}"`);
}
function resolveBackoff(config, path) {
	if (config !== void 0) validateKeys(config, BACKOFF_KEYS, path);
	const initialDelayMs = config?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
	const maxDelayMs = config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
	const jitterRatio = config?.jitterRatio ?? DEFAULT_JITTER_RATIO;
	if (!Number.isFinite(initialDelayMs) || initialDelayMs <= 0 || initialDelayMs > 2147483647) throw new Error(`${path}.initialDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	if (!Number.isFinite(maxDelayMs) || maxDelayMs <= 0 || maxDelayMs > 2147483647) throw new Error(`${path}.maxDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	if (initialDelayMs > maxDelayMs) throw new Error(`${path}.initialDelayMs must be less than or equal to maxDelayMs`);
	if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) throw new Error(`${path}.jitterRatio must be between 0 and 1`);
	return Object.freeze({
		initialDelayMs,
		maxDelayMs,
		jitterRatio
	});
}
/**
* Validate, default, and detach one provider-owned retry policy.
* @param config - optional provider configuration; omission selects normal defaults.
* @param path - diagnostic path naming the provider config that owns the value.
* @returns an immutable policy safe to capture in provider registration state.
*/
function resolveRetryPolicy(config, path) {
	if (config === void 0) return Object.freeze({
		mode: "normal",
		maxRetries: DEFAULT_MAX_RETRIES,
		retryableCodes: DEFAULT_RETRYABLE_CODES,
		...resolveBackoff(void 0, `${path}.backoff`)
	});
	switch (config.mode) {
		case "normal": {
			validateKeys(config, NORMAL_POLICY_KEYS, path);
			const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
			const retryableCodes = config.retryableCodes ?? [...DEFAULT_RETRYABLE_CODES];
			if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) throw new Error(`${path}.maxRetries must be a non-negative safe integer`);
			if (retryableCodes.length === 0) throw new Error(`${path}.retryableCodes must not be empty`);
			if (retryableCodes.some((code) => typeof code !== "string" || code.length === 0)) throw new Error(`${path}.retryableCodes must contain only non-empty strings`);
			if (new Set(retryableCodes).size !== retryableCodes.length) throw new Error(`${path}.retryableCodes must not contain duplicates`);
			return Object.freeze({
				mode: "normal",
				maxRetries,
				retryableCodes: Object.freeze([...retryableCodes]),
				...resolveBackoff(config.backoff, `${path}.backoff`)
			});
		}
		case "always":
			validateKeys(config, ALWAYS_POLICY_KEYS, path);
			return Object.freeze({
				mode: "always",
				...resolveBackoff(config.backoff, `${path}.backoff`)
			});
		default: throw new Error(`${path}.mode must be "normal" or "always"`);
	}
}
/**
* Normalization for values thrown by a final LLM adapter boundary.
*
* @module @deepseek-ai/dsh-llm/adapter-failure
*/
/**
* Detach serializable provider facts from a value thrown by an adapter.
* @param value - arbitrary value thrown during adapter dispatch or iteration.
* @returns immutable provider-neutral facts suitable for a terminal finish chunk.
* @internal
*/
function normalizeLlmFailure(value) {
	const error = value instanceof Error ? value : new HarnessError(thrownMessage(value), "UNKNOWN", { cause: value });
	const carried = ownFailureSnapshot(error);
	if (carried !== void 0 && carried.code === ownErrorCode(error)) return carried;
	return Object.freeze({
		message: errorMessage$1(error),
		code: harnessErrorCode(error)
	});
}
/** Render a non-Error throw without letting hostile coercion escape normalization. */
function thrownMessage(value) {
	try {
		const message = String(value);
		return message.length > 0 ? message : "LLM adapter failed";
	} catch (_hostileThrownValue) {
		return "LLM adapter failed";
	}
}
/** Read a foreign error's own data-backed `code` without invoking accessors. */
function ownErrorCode(error) {
	try {
		const descriptor = Object.getOwnPropertyDescriptor(error, "code");
		return descriptor !== void 0 && "value" in descriptor ? descriptor.value : void 0;
	} catch (_sdkPropertyTrap) {
		return;
	}
}
/** Snapshot an own data property without invoking an SDK-defined accessor. */
function ownFailureSnapshot(error) {
	try {
		const descriptor = Object.getOwnPropertyDescriptor(error, "failure");
		return descriptor !== void 0 && "value" in descriptor ? failureSnapshot(descriptor.value) : void 0;
	} catch (_sdkPropertyTrap) {
		return;
	}
}
/** Validate and detach an arbitrary serializable failure payload. */
function failureSnapshot(value) {
	if (typeof value !== "object" || value === null) return void 0;
	try {
		const candidate = value;
		const message = candidate.message;
		const code = candidate.code;
		const status = candidate.status;
		const providerRetryAfterMs = candidate.providerRetryAfterMs;
		const requestId = candidate.requestId;
		if (typeof message !== "string" || message.length === 0 || typeof code !== "string" || code.length === 0 || status !== void 0 && (!Number.isInteger(status) || status < 100 || status > 599) || providerRetryAfterMs !== void 0 && (!Number.isFinite(providerRetryAfterMs) || providerRetryAfterMs <= 0) || requestId !== void 0 && (typeof requestId !== "string" || requestId.length === 0)) return void 0;
		return Object.freeze({
			message,
			code,
			...status === void 0 ? {} : { status },
			...providerRetryAfterMs === void 0 ? {} : { providerRetryAfterMs },
			...requestId === void 0 ? {} : { requestId }
		});
	} catch (_sdkFailureGetter) {
		return;
	}
}
/** Read an SDK error message without letting an accessor replace the primary failure. */
function errorMessage$1(error) {
	try {
		const message = error.message;
		if (typeof message === "string" && message.length > 0) return message;
	} catch (_sdkMessageGetter) {}
	return "LLM adapter failed";
}
/** Trust only Harness-owned codes; third-party SDK codes are not our taxonomy. */
function harnessErrorCode(error) {
	return error instanceof HarnessError ? error.code : "UNKNOWN";
}
/**
* Exhaustiveness helper for closed core unions. Use {@link assertNever} at the default branch so a
* new variant fails compilation at every required handler. Do not use it for declaration-merged
* unions such as session events or content blocks: handle known variants and explicitly fall
* through because plugins may add valid unknown cases.
* @module @deepseek-ai/dsh-llm/never
*/
/**
* Mark an unreachable closed-union branch. A newly unhandled typed variant fails at the call site;
* a value that escaped its type throws with diagnostics at runtime.
* @param value - the impossible value; typed `never` so an unhandled variant fails compilation at the call site.
* @param context - optional label (e.g. the switch site) prefixed into the throw message.
* @returns never — it always throws, with the offending value JSON-rendered in the message.
*/
function assertNever(value, context) {
	const rendered = JSON.stringify(value) ?? String(value);
	throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}
/**
* Stable text shown to a model that cannot accept one durable image reference.
* @param ref - durable normalized attachment omitted from the request.
* @returns deterministic text-only placeholder.
*/
function textOnlyImageText(ref) {
	return `[image omitted because this model accepts text only; attachment sha256:${String(ref.attachmentId).slice(7, 15)}]`;
}
/**
* True when typed model content contains an image block, walking nested
* tool-result content. This is the one recursive image walk shared by every
* image policy (capability gating, text-only serialization, compaction
* survey), so a consumer cannot silently diverge on nesting depth.
* @param content - typed model content blocks.
* @returns whether any nested block is an image.
*/
function contentHasImage(content) {
	return content.some((block) => block.type === "image" || block.type === "tool-result" && contentHasImage(block.content));
}
/** Replace every image occurrence, including nested tool results, for a text-only model. */
function replaceImagesForTextModel(blocks) {
	let next;
	for (const [index, block] of blocks.entries()) {
		if (block.type === "image") {
			next ??= blocks.slice(0, index);
			next.push({
				type: "text",
				text: textOnlyImageText(block.attachment)
			});
			continue;
		}
		if (block.type === "tool-result") {
			const content = replaceImagesForTextModel(block.content);
			if (content !== block.content) {
				next ??= blocks.slice(0, index);
				next.push({
					...block,
					content
				});
				continue;
			}
		}
		next?.push(block);
	}
	return next ?? blocks;
}
/**
* Project durable image history into deterministic text for an exact text-only model.
* @param messages - complete request history.
* @returns the original list without images, otherwise shallow message copies with stable placeholders.
*/
function projectImagesForTextModel(messages) {
	if (!messages.some((message) => contentHasImage(message.content))) return messages;
	return messages.map((message) => {
		const content = replaceImagesForTextModel(message.content);
		return content === message.content ? message : {
			...message,
			content
		};
	});
}
/**
* Centralize the non-secret product identity every provider request sends as `User-Agent`, keeping
* adapters from drifting. See
* `.agents/notes/implemented/architecture/2026-06-21-mandatory-app-attribution-headers.md`.
*
* App-attribution vocabulary for provider requests.
* @module @deepseek-ai/dsh-llm/attribution
*/
const { version } = createRequire(import.meta.url)("../package.json");
/**
* LLM service: adapter registry with a waterfall-interceptable streaming call
* API. Exports the `LlmRuntime` default, the abstract `LlmAdapter` for
* provider backends, and `BlockAssembler` for chunk assembly.
*
* @module @deepseek-ai/dsh-llm
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/**
* Typed error for LLM-related failures. Extends {@link HarnessError}, so the
* `code` string (e.g. `AUTH`, `RATE_LIMIT`, `NO_ADAPTER`) is shared taxonomy.
*/
var LlmError = class extends HarnessError {
	/** Serializable facts retained beside this live Error. */
	failure;
	/**
	* @param message - non-empty human-readable failure summary.
	* @param code - non-empty stable provider-neutral machine code.
	* @param options - optional cause and validated serializable provider facts.
	*/
	constructor(message, code, options) {
		if (typeof message !== "string" || message.length === 0) throw new Error("LlmError message must be a non-empty string");
		if (typeof code !== "string" || code.length === 0) throw new Error("LlmError code must be a non-empty string");
		if (options?.status !== void 0 && (!Number.isInteger(options.status) || options.status < 100 || options.status > 599)) throw new Error("LlmError status must be an integer from 100 through 599");
		if (options?.providerRetryAfterMs !== void 0 && (!Number.isFinite(options.providerRetryAfterMs) || options.providerRetryAfterMs <= 0)) throw new Error("LlmError providerRetryAfterMs must be a positive finite number");
		if (options?.requestId !== void 0 && (typeof options.requestId !== "string" || options.requestId.length === 0)) throw new Error("LlmError requestId must be a non-empty string");
		super(message, code, options);
		this.name = "LlmError";
		this.failure = Object.freeze({
			message,
			code,
			...options?.status === void 0 ? {} : { status: options.status },
			...options?.providerRetryAfterMs === void 0 ? {} : { providerRetryAfterMs: options.providerRetryAfterMs },
			...options?.requestId === void 0 ? {} : { requestId: options.requestId }
		});
	}
};
(() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _listProviders_decorators;
	let _listConfigurableProviders_decorators;
	let _remoteDiscoverModels_decorators;
	return class LlmRuntime extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_listProviders_decorators = [Remote];
			_listConfigurableProviders_decorators = [Remote];
			_remoteDiscoverModels_decorators = [Remote("discoverModels")];
			__esDecorate(this, null, _listProviders_decorators, {
				kind: "method",
				name: "listProviders",
				static: false,
				private: false,
				access: {
					has: (obj) => "listProviders" in obj,
					get: (obj) => obj.listProviders
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listConfigurableProviders_decorators, {
				kind: "method",
				name: "listConfigurableProviders",
				static: false,
				private: false,
				access: {
					has: (obj) => "listConfigurableProviders" in obj,
					get: (obj) => obj.listConfigurableProviders
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _remoteDiscoverModels_decorators, {
				kind: "method",
				name: "remoteDiscoverModels",
				static: false,
				private: false,
				access: {
					has: (obj) => "remoteDiscoverModels" in obj,
					get: (obj) => obj.remoteDiscoverModels
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		adapters = (__runInitializers(this, _instanceExtraInitializers), /* @__PURE__ */ new Map());
		directory = /* @__PURE__ */ new Map();
		discoveries = /* @__PURE__ */ new Map();
		constructor(ctx) {
			super(ctx, "llm");
		}
		/** Notify topology observers without letting one broken listener veto the commit. */
		emitAdaptersUpdated() {
			let invariantFailure;
			for (const listener of this.ctx.events.dispatch("emit", ["llm/adapters-updated"])) try {
				const returned = listener();
				if (returned != null && typeof returned.then === "function") Promise.resolve(returned).then(void 0, (error) => {
					this.warnAdaptersListenerFailure(error);
				});
			} catch (error) {
				if (error?.code === "INVARIANT") {
					invariantFailure ??= error;
					continue;
				}
				this.warnAdaptersListenerFailure(error);
			}
			if (invariantFailure !== void 0) throw invariantFailure;
		}
		/** Contained-listener diagnostic shared by the sync and async failure paths. */
		warnAdaptersListenerFailure(error) {
			this.ctx.logger.warn("llm: an llm/adapters-updated listener failed");
			this.ctx.logger.warn(error);
		}
		/**
		* Register an adapter for the given provider routes. Throws `LlmError` with code
		* `DUPLICATE_ADAPTER` if any provider already has an adapter (all-or-nothing).
		* Disposed with the fiber.
		* @param providers - every provider route this adapter should serve.
		* @param adapter - the adapter that streams calls for those providers.
		* @returns the disposer, carrying {@link AdapterRegistrationHandle.replace}.
		*/
		registerAdapter(providers, adapter) {
			const owned = /* @__PURE__ */ new Set();
			let released = false;
			const dispose = this.ctx.effect(function* () {
				if (providers.length === 0) throw new LlmError("an adapter must register at least one provider", "INVALID_ADAPTER");
				this.commitRoutes(owned, this.prepareRoutes(providers, adapter, owned));
				yield () => {
					released = true;
					for (const provider of owned) this.adapters.delete(provider);
					owned.clear();
					this.emitAdaptersUpdated();
				};
			}.bind(this), "llm.registerAdapter()");
			const handle = (() => void dispose());
			handle.replace = (next) => {
				if (released) throw new LlmError("a disposed adapter registration cannot replace its routes", "REGISTRATION_DISPOSED");
				this.commitRoutes(owned, this.prepareRoutes(next, adapter, owned));
			};
			return handle;
		}
		/**
		* Validate one candidate route set for `adapter`, treating routes this
		* registration already holds as available. Nothing is mutated: a rejected
		* candidate leaves the registry exactly as it was.
		*/
		prepareRoutes(providers, adapter, owned) {
			const unique = /* @__PURE__ */ new Set();
			const registrations = [];
			for (const provider of providers) {
				if (provider.length === 0) throw new LlmError("adapter provider names must be non-empty", "INVALID_ADAPTER");
				if (unique.has(provider) || this.adapters.has(provider) && !owned.has(provider)) throw new LlmError(`an adapter for provider "${provider}" is already registered`, "DUPLICATE_ADAPTER");
				const info = adapter.providerInfo(provider);
				if (typeof info.id !== "string" || info.id !== provider || typeof info.name !== "string" || info.name.length === 0) throw new LlmError(`adapter metadata for provider "${provider}" must preserve its id and have a non-empty name`, "INVALID_ADAPTER");
				unique.add(provider);
				const retryPolicy = adapter.providerRetryPolicy(provider) ?? resolveRetryPolicy(void 0, `llm: provider "${provider}" retryPolicy`);
				registrations.push({
					adapter,
					provider: {
						id: info.id,
						name: info.name
					},
					retryPolicy
				});
			}
			return registrations;
		}
		/**
		* Swap this registration's routes for the prepared ones in one synchronous
		* section, so no observer can see the registry between the release and the
		* re-registration. The route set's one mutation point is also where
		* `llm/adapters-updated` is published, so a `replace` announces itself
		* exactly like a first registration.
		*/
		commitRoutes(owned, registrations) {
			for (const provider of owned) this.adapters.delete(provider);
			owned.clear();
			for (const registration of registrations) {
				this.adapters.set(registration.provider.id, registration);
				owned.add(registration.provider.id);
			}
			this.emitAdaptersUpdated();
		}
		/**
		* Describe provider routes with a registered adapter.
		* @returns detached provider metadata in registration order.
		*/
		listProviders() {
			return [...this.adapters.values()].map(({ provider }) => ({ ...provider }));
		}
		/**
		* Declare provider routes an adapter plugin can activate through
		* configuration. Registration is all-or-nothing: an empty list, invalid
		* entry, or a provider already declared by any registration throws
		* `LlmError` without registering the rest. Disposed with the fiber.
		* @param entries - every configurable provider this plugin owns.
		* @returns a handle that withdraws all of them, and can atomically replace them.
		*/
		registerConfigurableProviders(entries) {
			let held = [];
			let disposed = false;
			/**
			* Validate a candidate set in full against everything this registration
			* does not already hold, then publish it. Nothing is written until the
			* whole set passes, so a refused candidate leaves the current entries in
			* place — the property that makes `replace` a swap rather than a
			* delete-then-add that can strand the directory empty.
			*/
			const commit = (candidates) => {
				const detached = [];
				const own = new Set(held.map((entry) => entry.provider));
				for (const entry of candidates) {
					if (entry.provider.length === 0 || entry.displayName.length === 0 || entry.settingsNs.length === 0) throw new LlmError("configurable providers need a non-empty provider, displayName, and settingsNs", "INVALID_DIRECTORY");
					if (entry.settingsPath.some((segment) => segment.length === 0)) throw new LlmError(`configurable provider "${entry.provider}" has an empty settingsPath segment`, "INVALID_DIRECTORY");
					if (this.directory.has(entry.provider) && !own.has(entry.provider) || detached.some((seen) => seen.provider === entry.provider)) throw new LlmError(`configurable provider "${entry.provider}" is already declared`, "DUPLICATE_DIRECTORY");
					detached.push({
						...entry,
						settingsPath: [...entry.settingsPath]
					});
				}
				for (const entry of held) this.directory.delete(entry.provider);
				for (const entry of detached) this.directory.set(entry.provider, entry);
				held = detached;
				this.emitAdaptersUpdated();
			};
			const dispose = this.ctx.effect(function* () {
				if (entries.length === 0) throw new LlmError("a configurable-provider registration must declare at least one provider", "INVALID_DIRECTORY");
				commit(entries);
				yield () => {
					disposed = true;
					for (const entry of held) this.directory.delete(entry.provider);
					held = [];
					this.emitAdaptersUpdated();
				};
			}.bind(this), "llm.registerConfigurableProviders()");
			const handle = (() => void dispose());
			handle.replace = (next) => {
				if (disposed) throw new LlmError("this configurable-provider registration was disposed", "REGISTRATION_DISPOSED");
				commit(next);
			};
			return handle;
		}
		/**
		* List every declared configurable provider, registered or dormant.
		* @returns detached directory entries in declaration order.
		*/
		listConfigurableProviders() {
			return [...this.directory.values()].map((entry) => ({
				...entry,
				settingsPath: [...entry.settingsPath]
			}));
		}
		/**
		* Offer to interrogate provider endpoints on behalf of the settings
		* namespace this plugin owns. The namespace is the key because that is what
		* a configuration surface already holds from the configurable-provider
		* directory, and because a provider being *added* has no route to name yet.
		* Disposed with the fiber.
		* @param settingsNs - the namespace whose profiles this discovery serves.
		* @param discover - interrogates one endpoint and must honor the supplied signal.
		* @returns the disposer that withdraws the offer.
		*/
		registerModelDiscovery(settingsNs, discover) {
			const dispose = this.ctx.effect(function* () {
				if (settingsNs.length === 0) throw new LlmError("model discovery needs a non-empty settings namespace", "INVALID_DISCOVERY");
				if (this.discoveries.has(settingsNs)) throw new LlmError(`model discovery for "${settingsNs}" is already registered`, "DUPLICATE_DISCOVERY");
				this.discoveries.set(settingsNs, discover);
				yield () => {
					this.discoveries.delete(settingsNs);
				};
			}.bind(this), "llm.registerModelDiscovery()");
			return () => void dispose();
		}
		/**
		* Interrogate one provider endpoint for the models it advertises. The
		* request describes a draft, not a stored route, so nothing here reads or
		* writes settings or credentials — the caller owns both, and the reply is
		* candidate metadata a surface may offer for adoption.
		* @param settingsNs - namespace whose registered discovery serves this draft.
		* @param request - the endpoint, protocol, and one-shot credential to use.
		* @param signal - caller cancellation.
		* @returns the advertised models, deduplicated in endpoint order.
		*/
		async discoverModels(settingsNs, request, signal) {
			const discover = this.discoveries.get(settingsNs);
			if (discover === void 0) throw new LlmError(`no model discovery is registered for "${settingsNs}"`, "NO_DISCOVERY");
			if ((request.provider ?? "").length === 0 && (request.baseURL ?? "").length === 0) throw new LlmError("model discovery needs a provider route or a baseURL", "INVALID_DISCOVERY");
			const discovered = signal === void 0 ? await discover(request) : await discover(request, signal);
			const seen = /* @__PURE__ */ new Set();
			const models = [];
			for (const model of discovered) {
				if (typeof model.id !== "string" || model.id.length === 0 || seen.has(model.id)) continue;
				seen.add(model.id);
				models.push({
					id: model.id,
					...model.name === void 0 ? {} : { name: model.name },
					...model.contextWindow === void 0 ? {} : { contextWindow: model.contextWindow },
					...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens }
				});
			}
			return models;
		}
		/**
		* Remote adapter for one draft provider interrogation.
		* @param settingsNs - namespace whose registered discovery serves this draft.
		* @param request - endpoint, protocol, and one-shot credential to use.
		* @param signal - caller cancellation supplied by the Remote carrier.
		* @returns advertised models in endpoint order.
		* @throws TypertRemoteFailure with `model-discovery-failed` when discovery refuses or fails.
		*/
		async remoteDiscoverModels(settingsNs, request, signal) {
			try {
				return await this.discoverModels(settingsNs, request, signal);
			} catch (error) {
				throw new TypertRemoteFailure({
					code: "model-discovery-failed",
					message: error instanceof Error ? error.message : String(error),
					details: {
						settingsNs,
						...request.baseURL === void 0 ? {} : { baseURL: request.baseURL }
					}
				});
			}
		}
		/**
		* Resolve the retry policy captured when one provider route was registered.
		* @param provider - registered provider route to inspect.
		* @returns the provider-owned policy, with normal defaults already resolved.
		*/
		providerRetryPolicy(provider) {
			return this.registration(provider).retryPolicy;
		}
		/**
		* Resolve provider-side request-image pricing for one exact route, or
		* `undefined` when the provider is unregistered or declares none. Unknown
		* providers degrade to `undefined` rather than throwing because callers
		* price durable history whose route may no longer be mounted.
		* @param provider - provider route named by a request header.
		* @param model - exact model id named by the same header.
		* @returns the owning adapter's image pricing for the route, when declared.
		*/
		imageRequestPricing(provider, model) {
			return this.adapters.get(provider)?.adapter.imageRequestPricing(provider, model);
		}
		/** Detach typed adapter-owned modality metadata. */
		detachedModalities(modalities) {
			return modalities === void 0 ? void 0 : [...modalities];
		}
		/**
		* Discover models advertised by one registered provider. Catalog membership
		* is advisory and never changes routing or request validation.
		* @param provider - registered provider route to inspect.
		* @returns detached model metadata in adapter-preferred order.
		*/
		async listModels(provider) {
			const models = await this.registration(provider).adapter.listModels(provider);
			const seen = /* @__PURE__ */ new Set();
			return models.map((model) => {
				if (typeof model.provider !== "string" || model.provider !== provider || typeof model.id !== "string" || model.id.length === 0 || typeof model.name !== "string" || model.name.length === 0 || model.description !== void 0 && typeof model.description !== "string" || seen.has(model.id)) throw new LlmError(`adapter returned invalid or duplicate model metadata for provider "${provider}"`, "INVALID_CATALOG");
				seen.add(model.id);
				const inputModalities = this.detachedModalities(model.inputModalities);
				return {
					provider: model.provider,
					id: model.id,
					name: model.name,
					...model.description === void 0 ? {} : { description: model.description },
					...inputModalities === void 0 ? {} : { inputModalities }
				};
			});
		}
		/**
		* Resolve and validate all metadata from the adapter that owns one exact
		* route. The result is detached from adapter-owned objects; catalog
		* membership remains advisory and does not control request routing.
		* @param provider - registered provider route to inspect.
		* @param model - exact model id passed to the adapter.
		* @param signal - optional cancellation for adapter-owned asynchronous lookup.
		* @returns exact model identity plus available context and reasoning metadata.
		*/
		async resolveModelInfo(provider, model, signal) {
			return this.resolveModelInfoFor(this.registration(provider), model, signal);
		}
		async resolveModelInfoFor(registration, model, signal) {
			const resolved = await registration.adapter.resolveModel(registration.provider.id, model, signal);
			return this.normalizeModelInfo(registration, model, resolved);
		}
		/** Validate and detach one adapter-returned exact model result. */
		normalizeModelInfo(registration, model, resolved) {
			const provider = registration.provider.id;
			if (typeof resolved.provider !== "string" || resolved.provider !== provider || typeof resolved.id !== "string" || resolved.id !== model || typeof resolved.name !== "string" || resolved.name.length === 0 || resolved.description !== void 0 && typeof resolved.description !== "string") throw new LlmError(`adapter returned invalid exact model metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
			const context = resolved.context;
			if (context !== void 0 && (!Number.isInteger(context.contextWindow) || context.contextWindow <= 0)) throw new LlmError(`adapter returned invalid context metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_CONTEXT");
			const inputModalities = this.detachedModalities(resolved.inputModalities);
			const defaultMaxTokens = resolved.defaultMaxTokens;
			if (defaultMaxTokens !== void 0 && (!Number.isSafeInteger(defaultMaxTokens) || defaultMaxTokens <= 0)) throw new LlmError(`adapter returned invalid default maxTokens for provider "${provider}" model "${model}"`, "INVALID_MODEL_MAX_TOKENS");
			const info = {
				provider,
				id: model,
				name: resolved.name,
				...resolved.description === void 0 ? {} : { description: resolved.description },
				...inputModalities === void 0 ? {} : { inputModalities },
				...context === void 0 ? {} : { context: { contextWindow: context.contextWindow } },
				...defaultMaxTokens === void 0 ? {} : { defaultMaxTokens }
			};
			const reasoning = resolved.reasoning;
			if (reasoning === void 0) return info;
			if (reasoning.efforts.length === 0) throw new LlmError(`adapter returned invalid reasoning metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
			const seen = /* @__PURE__ */ new Set();
			const efforts = reasoning.efforts.map((effort) => {
				if (typeof effort.id !== "string" || effort.id.length === 0 || typeof effort.name !== "string" || effort.name.length === 0 || effort.description !== void 0 && typeof effort.description !== "string" || seen.has(effort.id)) throw new LlmError(`adapter returned invalid or duplicate reasoning effort metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
				seen.add(effort.id);
				return {
					id: effort.id,
					name: effort.name,
					...effort.description === void 0 ? {} : { description: effort.description }
				};
			});
			if (reasoning.defaultEffort !== void 0 && !seen.has(reasoning.defaultEffort)) throw new LlmError(`adapter returned an unknown default reasoning effort for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
			return {
				...info,
				reasoning: {
					efforts,
					...reasoning.defaultEffort === void 0 ? {} : { defaultEffort: reasoning.defaultEffort }
				}
			};
		}
		/**
		* Validate a conversation call config against its exact model capability and
		* materialize adapter-configured defaults. Unsupported explicit efforts
		* reject before provider I/O; no clamping or aliasing is performed. This
		* standalone query does not bind a later dispatch; use {@link prepareCall}
		* when logging and streaming must share one adapter registration.
		* @param config - provider/model route and optional request controls.
		* @param signal - optional cancellation for adapter-owned capability lookup.
		* @returns a detached config only when a default must be materialized.
		*/
		async resolveCallConfig(config, signal) {
			return (await this.resolveCallFor(this.registration(config.provider), config, signal)).config;
		}
		async resolveCallFor(registration, config, signal) {
			const info = await this.resolveModelInfoFor(registration, config.model, signal);
			return this.resolveCallWithInfo(config, info);
		}
		/** Validate request controls against one already-bound exact model result. */
		resolveCallWithInfo(config, info) {
			const defaulted = config.maxTokens === void 0 && info.defaultMaxTokens !== void 0 ? {
				...config,
				maxTokens: info.defaultMaxTokens
			} : config;
			const reasoning = info.reasoning;
			const requested = defaulted.reasoningEffort;
			let resolvedConfig = defaulted;
			if (reasoning === void 0) {
				if (requested !== void 0) throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${requested}"`, "UNSUPPORTED_REASONING_EFFORT");
			} else {
				const effective = requested ?? reasoning.defaultEffort;
				if (effective !== void 0) {
					if (!reasoning.efforts.some((effort) => effort.id === effective)) throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${effective}"`, "UNSUPPORTED_REASONING_EFFORT");
					if (requested !== effective) resolvedConfig = {
						...defaulted,
						reasoningEffort: effective
					};
				}
			}
			return {
				config: resolvedConfig,
				...info.context === void 0 ? {} : { context: info.context },
				modelInfo: info
			};
		}
		/**
		* Resolve one call under its current adapter registration. The returned
		* one-shot handle keeps that registration across header logging and dispatch,
		* so HMR cannot combine one adapter's capability result with another adapter.
		* @param config - provider/model route and optional request controls.
		* @param signal - optional cancellation for adapter-owned capability lookup.
		* @returns a prepared config and its registration-bound stream entry point.
		*/
		async prepareCall(config, signal) {
			const registration = this.registration(config.provider);
			const adapterCall = await this.prepareAdapterCall(registration.adapter, config.provider, config.model, signal);
			const modelInfo = this.normalizeModelInfo(registration, config.model, adapterCall.model);
			const resolved = this.resolveCallWithInfo(config, modelInfo);
			const resolvedConfig = deepFreeze$1(structuredClone(resolved.config));
			const context = resolved.context === void 0 ? void 0 : deepFreeze$1(structuredClone(resolved.context));
			const adapterDefaults = deepFreeze$1({
				...config.reasoningEffort === void 0 && resolvedConfig.reasoningEffort !== void 0 ? { reasoningEffort: true } : {},
				...config.maxTokens === void 0 && resolvedConfig.maxTokens !== void 0 ? { maxTokens: true } : {}
			});
			let dispatched = false;
			return Object.freeze({
				config: resolvedConfig,
				retryPolicy: registration.retryPolicy,
				adapterDefaults,
				...context === void 0 ? {} : { context },
				...modelInfo.inputModalities === void 0 ? {} : { inputModalities: Object.freeze([...modelInfo.inputModalities]) },
				stream: (options) => {
					if (dispatched) throw new LlmError("a prepared LLM call can only be dispatched once", "INVALID_PREPARED_CALL");
					if (!callConfigEquals(options, resolvedConfig)) throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
					dispatched = true;
					return this.streamWithRegistration(options, {
						registration,
						config: resolvedConfig,
						modelInfo,
						dispatch: (options) => adapterCall.stream(options)
					});
				}
			});
		}
		/**
		* dsh-desktop fix: adapter prepareCall guard — a custom-provider adapter built
		* against a pre-rc.2 kernel (the base LlmAdapter had no prepareCall) can be
		* missing prepareCall entirely. Fall back to the base semantics so the call
		* still works, and warn the user that the kernel needs an upgrade/reinstall.
		*/
		async prepareAdapterCall(adapter, provider, model, signal) {
			if (typeof adapter.prepareCall === "function") return adapter.prepareCall(provider, model, signal);
			console.warn("[dsh] LLM adapter for provider " + provider + " is missing prepareCall (built against an older kernel); falling back to base LlmAdapter.prepareCall semantics. Upgrade or reinstall the kernel to clear this warning.");
			return {
				model: await adapter.resolveModel(provider, model, signal),
				stream: (options) => adapter.stream(options)
			};
		}
		registration(provider) {
			const registration = this.adapters.get(provider);
			if (!registration) throw new LlmError(`no adapter registered for provider "${provider}"`, "NO_ADAPTER");
			return registration;
		}
		/** Remove replay state whose historical route is owned by another adapter. */
		forAdapter(options, adapter) {
			const messages = options.messages.map((message) => {
				const source = message.source;
				if (message.role !== "assistant" || source.kind !== "model" || source.replayState === void 0) return message;
				if (this.adapters.get(source.provider)?.adapter === adapter) return message;
				return freezeMessage({
					...message,
					source: {
						kind: "model",
						provider: source.provider,
						model: source.model
					}
				});
			});
			if (messages.every((message, index) => message === options.messages[index])) return options;
			const filtered = {
				...options,
				messages
			};
			return Object.isFrozen(options) ? deepFreeze$1(filtered) : filtered;
		}
		/**
		* Final adapter boundary. Adapter selection, dispatch, iterator construction,
		* and iteration failures become one terminal failure chunk. Middleware and
		* downstream consumer failures remain thrown plugin or consumer errors.
		*/
		async *adapterStream(options, prepared) {
			let iterator;
			try {
				const registration = prepared?.registration ?? this.registration(options.provider);
				const adapter = registration.adapter;
				let modelInfo;
				let resolvedConfig;
				let dispatch;
				if (prepared === void 0) {
					const adapterCall = await this.prepareAdapterCall(adapter, options.provider, options.model, options.signal);
					modelInfo = this.normalizeModelInfo(registration, options.model, adapterCall.model);
					resolvedConfig = this.resolveCallWithInfo(options, modelInfo).config;
					dispatch = (options) => adapterCall.stream(options);
				} else {
					modelInfo = prepared.modelInfo;
					resolvedConfig = prepared.config;
					dispatch = prepared.dispatch;
				}
				if (prepared !== void 0 && !callConfigEquals(options, resolvedConfig)) throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
				const resolvedOptions = callConfigEquals(options, resolvedConfig) ? options : Object.isFrozen(options) ? deepFreeze$1({
					...options,
					...resolvedConfig
				}) : {
					...options,
					...resolvedConfig
				};
				const projectedOptions = modelInfo.inputModalities !== void 0 && !modelInfo.inputModalities.includes("image") && resolvedOptions.messages.some((message) => contentHasImage(message.content)) ? Object.isFrozen(resolvedOptions) ? deepFreeze$1({
					...resolvedOptions,
					messages: projectImagesForTextModel(resolvedOptions.messages)
				}) : {
					...resolvedOptions,
					messages: projectImagesForTextModel(resolvedOptions.messages)
				} : resolvedOptions;
				iterator = dispatch(this.forAdapter(projectedOptions, adapter))[Symbol.asyncIterator]();
			} catch (error) {
				yield adapterFailureChunk(error, options.signal);
				return;
			}
			let completed = false;
			try {
				while (true) {
					let item;
					try {
						const next = await iterator.next();
						item = next.done ? { done: true } : {
							done: false,
							value: next.value
						};
					} catch (error) {
						completed = true;
						yield adapterFailureChunk(error, options.signal);
						return;
					}
					if (item.done) {
						completed = true;
						return;
					}
					yield item.value;
				}
			} finally {
				if (!completed) {
					const close = iterator.return?.bind(iterator);
					if (close) await close();
				}
			}
		}
		/**
		* Stream one model call as raw chunks (token-level deltas). Replay state is
		* retained only when the same adapter instance owns its historical provider
		* and the target provider. Final adapter selection remains fixed through
		* asynchronous exact-model resolution and dispatch. Adapter selection,
		* dispatch, and iteration failures become terminal `error` or `aborted`
		* finish chunks; middleware, nested-call, cleanup, and consumer failures
		* remain thrown.
		* @param options - the full request; `options.provider` selects the adapter.
		* @returns the chunk stream, possibly wrapped by `llm/stream` listeners.
		*/
		stream(options) {
			return this.streamWithRegistration(options);
		}
		streamWithRegistration(options, prepared) {
			return this.ctx.waterfall(this, "llm/stream", options, () => this.adapterStream(options, prepared));
		}
	};
})();
/** Convert one adapter throw into the stream protocol's terminal outcome. */
function adapterFailureChunk(error, signal) {
	const failure = normalizeLlmFailure(error);
	return {
		type: "finish",
		reason: signal?.aborted || failure.code === "ABORTED" ? {
			kind: "aborted",
			failure
		} : {
			kind: "error",
			failure
		}
	};
}
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/dsh-session/lib/index.js
/** Lossless-JSON validation and detached snapshots for durable session data. @module @deepseek-ai/dsh-session/json */
/** Whether a realm-owned intrinsic prototype is backed by its native constructor. */
function hasIntrinsicConstructor$1(prototype, name) {
	const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
	if (typeof constructor !== "function") return false;
	try {
		return constructor.name === name && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === `function ${name}() { [native code] }`;
	} catch {
		return false;
	}
}
/** Whether a candidate is one realm's intrinsic `Object.prototype`. */
function isIntrinsicObjectPrototype$1(value) {
	return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor$1(value, "Object");
}
/** Whether an array uses one realm's intrinsic `Array.prototype`, not a subclass or forged prototype. */
function hasPlainArrayPrototype$1(value) {
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(prototype) || !hasIntrinsicConstructor$1(prototype, "Array")) return false;
	const objectPrototype = Object.getPrototypeOf(prototype);
	return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype$1(objectPrototype);
}
/** Whether an object is a plain or null-prototype record from any JavaScript realm. */
function hasPlainObjectPrototype(value) {
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype$1(prototype);
}
/** Return every JSON-visible object key, or reject own data JSON would discard. */
function enumerableStringKeys(value) {
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(value, key))) return void 0;
	return keys;
}
/** Validate lossless JSON iteratively, optionally materializing a detached snapshot. */
function walkJsonValue(value, detach) {
	const ancestors = /* @__PURE__ */ new Set();
	let root;
	const assign = (destination, item) => {
		if (destination === void 0) return;
		if (destination.kind === "root") root = item;
		else if (destination.kind === "array") destination.target[destination.index] = item;
		else Object.defineProperty(destination.target, destination.key, {
			value: item,
			enumerable: true,
			configurable: true,
			writable: true
		});
	};
	const tasks = [{
		kind: "visit",
		value,
		...detach ? { destination: { kind: "root" } } : {}
	}];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (task.kind === "leave") {
			ancestors.delete(task.source);
			continue;
		}
		if (task.kind === "array-item") {
			if (!Object.prototype.hasOwnProperty.call(task.source, task.index)) return void 0;
			tasks.push({
				kind: "visit",
				value: task.source[task.index],
				...task.target === void 0 ? {} : { destination: {
					kind: "array",
					target: task.target,
					index: task.index
				} }
			});
			continue;
		}
		if (task.kind === "object-property") {
			tasks.push({
				kind: "visit",
				value: task.source[task.key],
				...task.target === void 0 ? {} : { destination: {
					kind: "object",
					target: task.target,
					key: task.key
				} }
			});
			continue;
		}
		const current = task.value;
		if (current === null) {
			assign(task.destination, null);
			continue;
		}
		if (typeof current === "boolean" || typeof current === "string") {
			assign(task.destination, current);
			continue;
		}
		if (typeof current === "number") {
			if (!Number.isFinite(current) || Object.is(current, -0)) return void 0;
			assign(task.destination, current);
			continue;
		}
		if (typeof current !== "object") return void 0;
		if (ancestors.has(current)) return void 0;
		if (Array.isArray(current)) {
			if (!hasPlainArrayPrototype$1(current)) return void 0;
			const length = current.length;
			if (Reflect.ownKeys(current).length !== length + 1) return void 0;
			const target = detach ? [] : void 0;
			if (target !== void 0) assign(task.destination, target);
			ancestors.add(current);
			tasks.push({
				kind: "leave",
				source: current
			});
			for (let index = length - 1; index >= 0; index--) tasks.push({
				kind: "array-item",
				source: current,
				index,
				...target === void 0 ? {} : { target }
			});
			continue;
		}
		if (!hasPlainObjectPrototype(current)) return void 0;
		const keys = enumerableStringKeys(current);
		if (keys === void 0) return void 0;
		const target = detach ? {} : void 0;
		if (target !== void 0) assign(task.destination, target);
		ancestors.add(current);
		tasks.push({
			kind: "leave",
			source: current
		});
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) return void 0;
			tasks.push({
				kind: "object-property",
				source: current,
				key,
				...target === void 0 ? {} : { target }
			});
		}
	}
	return detach ? root : true;
}
/**
* Validate and detach lossless JSON in one read per property, so a stateful
* getter cannot change between validation and copying. Traversal is iterative,
* so valid nesting is bounded by available memory rather than the JavaScript
* call stack. Accepts ordinary arrays, plain or null-prototype objects, and JSON
* scalars; rejects sparse, cyclic, exotic, negative-zero, and non-finite values.
* Getter throws propagate.
*
* @param value - the candidate value to validate and detach.
* @returns the detached snapshot, or `undefined` when the value is not
*   losslessly JSON-serializable.
*/
function snapshotJsonValue(value) {
	return walkJsonValue(value, true);
}
/**
* Test the same lossless JSON boundary as {@link snapshotJsonValue} without
* detaching it. Only own enumerable string properties participate; `toJSON`
* is ignored and getters run, so persistence boundaries use the snapshotter.
* @param value - the candidate event data to test.
* @returns whether `value` survives JSON round-trip losslessly.
*/
function isJsonValue(value) {
	return walkJsonValue(value, false) === true;
}
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js
/**
* Registry for ordered system sections, dynamic context, tool schemas, and prompt variables.
*
* @module @deepseek-ai/dsh-system-prompt
*/
/**
* Sparse integer placements for repository-owned prompt sections.
*
* Adjacent values differ by at least ten to keep the first-party groups sparse
* and make accidental collisions mechanically detectable.
* External plugins may use any finite order; equal orders are deterministic by
* section name.
*/
const FIRST_PARTY_SECTION_ORDER = {
	HARNESS_IDENTITY: -1e3,
	HARNESS_SOURCE: -900,
	WEB_SURFACE: -800,
	DEPLOYMENT_PERSONA: 0,
	PLAN_POLICY: 500,
	TEAM_POLICY: 600,
	PTC_ONLY: 800,
	FILE_REFERENCE: 900,
	TOOL_BASH: 1e3,
	TOOL_PWSH: 1010,
	TOOL_READ: 1100,
	TOOL_WRITE: 1200,
	TOOL_EDIT: 1300,
	TOOL_GLOB: 1400,
	TOOL_GREP: 1500,
	TOOL_JOBS: 1600,
	TOOL_PTY: 1700,
	TOOL_WEB_SEARCH: 2e3,
	TOOL_WEB_FETCH: 2100,
	TOOL_LSP: 2200,
	TOOL_SESSION_QUERY: 2300,
	TOOL_GOAL: 2400,
	TOOL_CORDIS: 2500,
	TOOL_WORKFLOW: 2600,
	TOOL_RALPH: 2700,
	TOOL_SUBAGENT: 2800,
	TOOL_REPORT: 2900,
	TOOLS_SDK: 5e3,
	DELIVERABLE_FILE_REFERENCES: 9e3,
	STRUCTURED_OUTPUT: 9900
};
/**
* The deployment persona's section name and order. Exported because a
* composition can replace this slot — an agent preset shadows the
* deployment's persona with its own — and both sides naming the same section
* is what makes the replacement work rather than duplicate.
*/
const PERSONA_SECTION = "deployment:persona";
/** Prompt order of the persona slot. */
const PERSONA_ORDER = FIRST_PARTY_SECTION_ORDER.DEPLOYMENT_PERSONA;
/** Valid variable names: how they are written between the braces. */
const VARIABLE_NAME = /^[a-z][a-z0-9_]*$/;
/** Reserved {@link Config.toolOrder} marker for unlisted tools. */
const TOOL_ORDER_REST = "<unlisted-tools>";
/**
* Validate duplicate names and the required {@link TOOL_ORDER_REST} marker.
* Registered names are checked later because plugins have not loaded yet.
*/
function validateToolOrder(toolOrder) {
	if (toolOrder === void 0) return void 0;
	const seen = /* @__PURE__ */ new Set();
	for (const name of toolOrder) {
		if (seen.has(name)) throw new Error(`toolOrder lists "${name}" more than once`);
		seen.add(name);
	}
	if (!seen.has("<unlisted-tools>")) throw new Error(`toolOrder must contain the "${TOOL_ORDER_REST}" rest entry (where unlisted tools are inserted)`);
	return toolOrder;
}
/**
* Apply configured tool order, inserting unlisted tools lexicographically at
* {@link TOOL_ORDER_REST}. Unknown configured names fail; known but restricted
* names may be absent.
*/
function orderTools(tools, toolOrder, knownNames) {
	if (tools.find((tool) => tool.name === "<unlisted-tools>") !== void 0) throw new Error(`tool provider returned reserved tool name "${TOOL_ORDER_REST}" (reserved for toolOrder's rest entry)`);
	if (toolOrder === void 0) return tools.sort(compareToolNames);
	const unknown = toolOrder.filter((name) => name !== "<unlisted-tools>" && !knownNames.has(name));
	if (unknown.length > 0) throw new Error(`toolOrder lists unregistered tool${unknown.length > 1 ? "s" : ""} ${unknown.map((name) => `"${name}"`).join(", ")}; known tools: ${[...knownNames].sort().join(", ") || "(none)"}`);
	const listed = new Set(toolOrder);
	const rest = tools.filter((tool) => !listed.has(tool.name)).sort(compareToolNames);
	return toolOrder.flatMap((name) => name === "<unlisted-tools>" ? rest : tools.filter((tool) => tool.name === name));
}
/** Code-unit name comparison — locale-independent, so the order is identical on every machine. */
function compareNames(a, b) {
	return a < b ? -1 : a > b ? 1 : 0;
}
/** Order prompt sections by their explicit placement, then deterministically by name. */
function comparePromptSections(a, b) {
	return a.order - b.order || compareNames(a.name, b.name);
}
/** Order tool schemas lexicographically by name. */
function compareToolNames(a, b) {
	return compareNames(a.name, b.name);
}
/** All prompt registrations owned by one global or scoped layer. */
var PromptLayer = class {
	sections;
	contexts;
	runtimeContextSuppressors = new AnonymousEntries();
	toolProviders = new AnonymousEntries();
	variables;
	/**
	* Create one prompt layer with diagnostics specific to its ownership scope.
	* @param scope - the scoped owner, or `undefined` for global registrations.
	*/
	constructor(scope) {
		this.sections = new NamedEntries((name) => /* @__PURE__ */ new Error(scope === void 0 ? `prompt section "${name}" is already registered (for a per-agent override, register through that agent's \`agent.ctx\` instead)` : `prompt section "${name}" is already registered in this scope`));
		this.contexts = new NamedEntries((name) => /* @__PURE__ */ new Error(scope === void 0 ? `prompt context "${name}" is already registered (for a per-agent override, register through that agent's \`agent.ctx\` instead)` : `prompt context "${name}" is already registered in this scope`));
		this.variables = new NamedEntries((name) => /* @__PURE__ */ new Error(scope === void 0 ? `prompt variable "${name}" is already registered (for a per-agent value, register through that agent's \`agent.ctx\` instead)` : `prompt variable "${name}" is already registered in this scope`));
	}
	/** @returns whether this layer owns no prompt registrations. */
	isEmpty() {
		return this.sections.isEmpty() && this.contexts.isEmpty() && this.runtimeContextSuppressors.isEmpty() && this.toolProviders.isEmpty() && this.variables.isEmpty();
	}
};
(class extends Service {
	static Config = Schema.object({
		includeHarnessIdentity: Schema.boolean().default(true),
		includeRuntimeContext: Schema.boolean().default(true),
		persona: Schema.string().default(""),
		toolOrder: Schema.array(Schema.string()).default(void 0)
	});
	layers = new ScopedLayers((scope) => new PromptLayer(scope), () => {
		this.ctx.emit("system-prompt/change");
	});
	toolOrder;
	constructor(ctx, config) {
		super(ctx, "systemPrompt");
		this.toolOrder = validateToolOrder(config.toolOrder);
		if (config.includeHarnessIdentity ?? true) this.section({
			name: "harness:identity",
			order: FIRST_PARTY_SECTION_ORDER.HARNESS_IDENTITY,
			text: "You are an AI agent powered by DeepSeek Harness."
		});
		this.section({
			name: PERSONA_SECTION,
			order: PERSONA_ORDER,
			text: config.persona ?? ""
		});
		if (!(config.includeRuntimeContext ?? true)) this.suppressRuntimeContext();
	}
	/**
	* Register an ordered prompt section in the calling context's scope. A scoped
	* section shadows a global section with the same name; duplicates within one
	* layer and non-finite orders throw. Registration and disposal emit
	* `system-prompt/change`.
	* @param section - the section to register.
	* @returns the exact Cordis effect disposer.
	*/
	section(section) {
		if (!Number.isFinite(section.order)) throw new TypeError(`prompt section "${section.name}" order must be a finite number`);
		return this.layers.effect(this.ctx, (layer) => layer.sections.insert(section.name, section), { label: "systemPrompt.section()" });
	}
	/**
	* Register ordered dynamic context in the calling context's scope. Scoped
	* entries shadow global entries with the same name.
	* @param context - the context contribution to register.
	* @returns the exact Cordis effect disposer.
	*/
	context(context) {
		if (!Number.isFinite(context.order)) throw new TypeError(`prompt context "${context.name}" order must be a finite number`);
		return this.layers.effect(this.ctx, (layer) => layer.contexts.insert(context.name, context), { label: "systemPrompt.context()" });
	}
	/**
	* Suppress every dynamic runtime-context contribution in the calling
	* context's scope without changing the services that own or enforce those
	* facts. Multiple suppressors remain independently disposable.
	* @returns the exact Cordis effect disposer.
	*/
	suppressRuntimeContext() {
		return this.layers.effect(this.ctx, (layer) => layer.runtimeContextSuppressors.append(true), { label: "systemPrompt.suppressRuntimeContext()" });
	}
	/**
	* Register a tool-schema provider in the calling context's scope. Global and
	* matching scoped providers both contribute; returning the reserved
	* {@link TOOL_ORDER_REST} name makes assembly fail.
	* @param provider - evaluated for each assembly with its context.
	* @returns the exact Cordis effect disposer.
	*/
	tools(provider) {
		return this.layers.effect(this.ctx, (layer) => layer.toolProviders.append(provider), { label: "systemPrompt.tools()" });
	}
	/**
	* Register a prompt variable in the calling context's scope. Scoped values
	* shadow globals; invalid or duplicate names throw. A provider may return
	* `undefined`, but rendering a section that references that value then fails.
	* @param name - the `[a-z][a-z0-9_]*` reference name.
	* @param provider - evaluated for each assembly.
	* @returns the exact Cordis effect disposer.
	*/
	variable(name, provider) {
		if (!VARIABLE_NAME.test(name)) throw new Error(`invalid prompt variable name "${name}" (must match ${String(VARIABLE_NAME)})`);
		return this.layers.effect(this.ctx, (layer) => layer.variables.insert(name, provider), { label: "systemPrompt.variable()" });
	}
	/**
	* Assemble global and scoped providers, detach tool parameters, apply
	* canonical ordering, then run the assembly waterfall. Scoped sections and
	* variables shadow globals. The returned waterfall value is authoritative
	* except that an effective complete section is restored afterwards as the
	* sole prompt section.
	* @param context - the optional scope and plugin-defined assembly fields.
	* @returns the post-waterfall assembly with any complete prompt enforced.
	*/
	async assemble(context = {}) {
		const scope = context.scope;
		const scopeLayers = this.layers.chainLayers(scope);
		const runtimeContextSuppressed = !this.layers.global.runtimeContextSuppressors.isEmpty() || scopeLayers.some((layer) => !layer.runtimeContextSuppressors.isEmpty());
		const variables = {};
		for (const [name, provider] of this.layers.global.variables.entries()) variables[name] = provider(context);
		for (const layer of scopeLayers) for (const [name, provider] of layer.variables.entries()) variables[name] = provider(context);
		const sectionByName = this.layers.merge(scope, (layer) => layer.sections);
		const contextByName = this.layers.merge(scope, (layer) => layer.contexts);
		const providers = [...this.layers.global.toolProviders.values(), ...scopeLayers.flatMap((layer) => [...layer.toolProviders.values()])];
		const collected = [];
		const knownNames = /* @__PURE__ */ new Set();
		for (const provider of providers) {
			const result = provider(context);
			const schemas = result.schemas.map(({ name, description, parameters }) => ({
				name,
				description,
				parameters: structuredClone(parameters)
			}));
			const acceptedKnownNames = result.knownNames ?? schemas.map((tool) => tool.name);
			collected.push(...schemas);
			for (const name of acceptedKnownNames) knownNames.add(name);
		}
		const sectionDefinitions = [...sectionByName.values()].sort(comparePromptSections);
		const completeSections = sectionDefinitions.filter((section) => section.complete === true);
		if (completeSections.length > 1) throw new Error(`multiple complete prompt sections are active: ${completeSections.map((section) => JSON.stringify(section.name)).join(", ")}`);
		let completeSection;
		const assembly = {
			sections: sectionDefinitions.map((section) => {
				const assembled = {
					name: section.name,
					text: typeof section.text === "function" ? section.text(context) : section.text
				};
				if (section.complete === true) completeSection = { ...assembled };
				return assembled;
			}),
			contexts: runtimeContextSuppressed ? [] : [...contextByName.values()].sort((a, b) => a.order - b.order).map((entry) => ({
				name: entry.name,
				text: typeof entry.text === "function" ? entry.text(context) : entry.text
			})),
			tools: orderTools(collected, this.toolOrder, knownNames),
			variables
		};
		const transformed = await this.ctx.waterfall(scopeTarget(this, scope), "system-prompt/assemble", assembly, context, () => Promise.resolve(assembly));
		if (completeSection === void 0 && !runtimeContextSuppressed) return transformed;
		return {
			...transformed,
			sections: completeSection === void 0 ? transformed.sections : [completeSection],
			contexts: runtimeContextSuppressed ? [] : transformed.contexts
		};
	}
});
//#endregion
//#region D:/DSH Desktop/dsh-desktop/node_modules/@deepseek-ai/dsh-tools/lib/index.js
/**
* Enforced JSON Schema subset shared by tool outputs, generated PTC mode
* types, subagents, and workflows. The subset accepts any JSON root, an
* annotation-only schema for unconstrained JSON, one scalar `type`, object
* `properties`/`required`/boolean `additionalProperties`, array `items`,
* type-correct scalar `enum`/`const`, and exact-one `oneOf`.
*
* Unsupported or misplaced keywords reject rather than being accepted without
* enforcement. Consumers that require an object root apply
* {@link assertObjectJsonSchema} before accepting input.
* @module dsh-tools/json-schema
*/
/**
* Thrown when a raw schema falls outside the enforced subset. `violations`
* lists every offending path instead of stopping at the first author error.
*/
var JsonSchemaError = class extends HarnessError {
	/** Individual schema violations in walk order. */
	violations;
	constructor(violations) {
		super(`unsupported JSON schema: ${violations.join("; ")}`, "UNSUPPORTED_SCHEMA");
		this.name = "JsonSchemaError";
		this.violations = violations;
	}
};
const CONSTRAINT_KEYWORDS = /* @__PURE__ */ new Set([
	"type",
	"oneOf",
	"properties",
	"required",
	"additionalProperties",
	"items",
	"enum",
	"const"
]);
const ANNOTATION_KEYWORDS = /* @__PURE__ */ new Set([
	"description",
	"title",
	"default",
	"examples"
]);
const SCHEMA_TYPES = [
	"object",
	"array",
	"string",
	"number",
	"integer",
	"boolean",
	"null"
];
/** Whether a realm-owned intrinsic prototype is backed by its native constructor. */
function hasIntrinsicConstructor(prototype, name) {
	const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
	if (typeof constructor !== "function") return false;
	try {
		return constructor.name === name && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === `function ${name}() { [native code] }`;
	} catch {
		return false;
	}
}
/** Whether a candidate is one realm's intrinsic `Object.prototype`. */
function isIntrinsicObjectPrototype(value) {
	return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}
/**
* Test for a realm-agnostic plain JSON record without accepting arrays or
* exotic objects.
* @param value - candidate record from any JavaScript realm.
* @returns Whether the value has a plain-object prototype chain.
*/
function isPlainJsonRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	try {
		const prototype = Object.getPrototypeOf(value);
		return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype(prototype);
	} catch {
		return false;
	}
}
/** Whether an array uses one realm's intrinsic `Array.prototype`. */
function hasPlainArrayPrototype(value) {
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
	const objectPrototype = Object.getPrototypeOf(prototype);
	return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype(objectPrototype);
}
/** Return whether a record contains only own enumerable string keys. */
function hasOnlyEnumerableStringKeys(value) {
	try {
		return Reflect.ownKeys(value).every((key) => typeof key === "string" && Object.prototype.propertyIsEnumerable.call(value, key));
	} catch {
		return false;
	}
}
/**
* Test for an ordinary schema record whose keys survive JSON projection.
* @param value - candidate record from any JavaScript realm.
* @returns Whether the record has an intrinsic prototype and only own enumerable string keys.
*/
function isJsonSchemaRecord(value) {
	return isPlainJsonRecord(value) && hasOnlyEnumerableStringKeys(value);
}
/**
* Test for a dense ordinary array with no JSON-invisible decorations.
* @param value - candidate array from any JavaScript realm.
* @returns Whether the array is intrinsic, dense, and undecorated.
*/
function isPlainJsonArray(value) {
	if (!Array.isArray(value)) return false;
	try {
		if (!hasPlainArrayPrototype(value) || Reflect.ownKeys(value).length !== value.length + 1) return false;
		for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) return false;
		return true;
	} catch {
		return false;
	}
}
/** Lossless finite JSON number, excluding negative zero. */
function isJsonNumber(value) {
	return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0);
}
/** Whether a scalar is valid for one declared schema type. */
function scalarMatches(type, value) {
	switch (type) {
		case "string": return typeof value === "string";
		case "number": return isJsonNumber(value);
		case "integer": return isJsonNumber(value) && Number.isInteger(value);
		case "boolean": return typeof value === "boolean";
		case "null": return value === null;
		/* v8 ignore next -- JsonSchemaScalarType is closed; this retains compile-time exhaustiveness. */
		default: return assertNever(type, "JsonSchemaType");
	}
}
/** Keywords that are invalid beside `oneOf`. */
const ONE_OF_SIBLING_KEYWORDS = [
	"properties",
	"required",
	"additionalProperties",
	"items",
	"enum",
	"const"
];
/** Validate object-only fields after its property schemas have been visited. */
function checkObjectSchemaTail(node, path, properties, violations) {
	const hasRequired = Object.hasOwn(node, "required");
	const required = hasRequired ? node.required : void 0;
	if (hasRequired) if (!isPlainJsonArray(required) || required.some((entry) => typeof entry !== "string")) violations.push(`${path}.required must be an array of strings`);
	else {
		const declared = isJsonSchemaRecord(properties) ? properties : {};
		for (const key of required) if (!Object.hasOwn(declared, key)) violations.push(`${path}.required names "${key}" which is not in properties`);
	}
	if (Object.hasOwn(node, "additionalProperties") && typeof node.additionalProperties !== "boolean") violations.push(`${path}.additionalProperties must be a boolean`);
}
/** Collect every violation for one raw schema tree without using the JavaScript call stack. */
function checkSchemaNode(root, rootPath, violations, seen) {
	const tasks = [{
		kind: "enter",
		node: root,
		path: rootPath
	}];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (task.kind === "leave") {
			seen.delete(task.node);
			continue;
		}
		if (task.kind === "one-of-tail") {
			for (const key of ONE_OF_SIBLING_KEYWORDS) if (Object.hasOwn(task.node, key)) violations.push(`${task.path}.${key} is not supported beside oneOf`);
			continue;
		}
		if (task.kind === "object-tail") {
			checkObjectSchemaTail(task.node, task.path, task.properties, violations);
			continue;
		}
		const { node, path } = task;
		if (!isJsonSchemaRecord(node)) {
			violations.push(`${path} must be a schema object`);
			continue;
		}
		if (seen.has(node)) {
			violations.push(`${path} is circular`);
			continue;
		}
		seen.add(node);
		tasks.push({
			kind: "leave",
			node
		});
		for (const key of Object.keys(node)) {
			if (CONSTRAINT_KEYWORDS.has(key)) continue;
			if (ANNOTATION_KEYWORDS.has(key)) {
				try {
					if (!isJsonValue(node[key])) violations.push(`${path}.${key} annotation must be lossless JSON data`);
				} catch {
					violations.push(`${path}.${key} annotation must be lossless JSON data`);
				}
				continue;
			}
			violations.push(`${path}.${key} is not a supported keyword (subset: type/oneOf/properties/required/additionalProperties/items/enum/const + annotations)`);
		}
		if (Object.hasOwn(node, "description") && typeof node.description !== "string") violations.push(`${path}.description must be a string`);
		if (Object.hasOwn(node, "title") && typeof node.title !== "string") violations.push(`${path}.title must be a string`);
		const hasType = Object.hasOwn(node, "type");
		const hasOneOf = Object.hasOwn(node, "oneOf");
		if (hasType && hasOneOf) {
			violations.push(`${path} cannot declare both type and oneOf`);
			continue;
		}
		if (!hasType && !hasOneOf) {
			for (const key of ONE_OF_SIBLING_KEYWORDS) if (Object.hasOwn(node, key)) violations.push(`${path}.${key} requires type or oneOf`);
			continue;
		}
		if (hasOneOf) {
			const oneOf = node.oneOf;
			tasks.push({
				kind: "one-of-tail",
				node,
				path
			});
			if (!isPlainJsonArray(oneOf) || oneOf.length < 2) violations.push(`${path}.oneOf must be an array of at least two schemas`);
			else for (let index = oneOf.length - 1; index >= 0; index--) tasks.push({
				kind: "enter",
				node: oneOf[index],
				path: `${path}.oneOf[${index}]`
			});
			continue;
		}
		const type = node.type;
		if (typeof type !== "string" || !SCHEMA_TYPES.includes(type)) {
			violations.push(Array.isArray(type) ? `${path}.type must be a single type string (type arrays are not supported)` : `${path}.type must be one of ${SCHEMA_TYPES.join("/")}`);
			continue;
		}
		const schemaType = type;
		for (const [key, types] of Object.entries({
			properties: ["object"],
			required: ["object"],
			additionalProperties: ["object"],
			items: ["array"],
			enum: [
				"string",
				"number",
				"integer",
				"boolean",
				"null"
			],
			const: [
				"string",
				"number",
				"integer",
				"boolean",
				"null"
			]
		})) if (Object.hasOwn(node, key) && !types.includes(schemaType)) violations.push(`${path}.${key} is not supported on type "${schemaType}"`);
		switch (schemaType) {
			case "object": {
				const properties = Object.hasOwn(node, "properties") ? node.properties : void 0;
				tasks.push({
					kind: "object-tail",
					node,
					path,
					properties
				});
				if (Object.hasOwn(node, "properties")) if (!isJsonSchemaRecord(properties)) violations.push(`${path}.properties must be an object of schemas`);
				else {
					const entries = Object.entries(properties);
					for (let index = entries.length - 1; index >= 0; index--) {
						const entry = entries[index];
						/* v8 ignore next -- the loop is bounded by the captured entry count. */
						if (entry === void 0) continue;
						tasks.push({
							kind: "enter",
							node: entry[1],
							path: `${path}.properties.${entry[0]}`
						});
					}
				}
				break;
			}
			case "array":
				if (Object.hasOwn(node, "items")) tasks.push({
					kind: "enter",
					node: node.items,
					path: `${path}.items`
				});
				break;
			case "string":
			case "number":
			case "integer":
			case "boolean":
			case "null": {
				const hasEnum = Object.hasOwn(node, "enum");
				const allowed = hasEnum ? node.enum : void 0;
				const enumValid = isPlainJsonArray(allowed) && allowed.length > 0 && allowed.every((entry) => scalarMatches(schemaType, entry));
				if (hasEnum && !enumValid) violations.push(`${path}.enum must be a non-empty array of ${schemaType} values`);
				const hasConst = Object.hasOwn(node, "const");
				const declaredConst = hasConst ? node.const : void 0;
				const constValid = scalarMatches(schemaType, declaredConst);
				if (hasConst) {
					if (!constValid) violations.push(`${path}.const must be a ${schemaType} value`);
					else if (enumValid && !allowed.includes(declaredConst)) violations.push(`${path}.const must be one of ${path}.enum when both are declared`);
				}
				break;
			}
			/* v8 ignore next -- schemaType was narrowed from the closed SCHEMA_TYPES table above. */
			default: assertNever(schemaType, "JsonSchemaType");
		}
	}
}
/**
* Assert that an arbitrary raw schema uses only the enforced subset.
* Annotation-only schemas are accepted as the standard unconstrained-JSON
* form; callers that require an object root use {@link assertObjectJsonSchema}.
* @param schema - untrusted raw JSON Schema.
* @returns Assertion that the schema belongs to the supported subset.
*/
function assertSupportedJsonSchema(schema) {
	const violations = [];
	checkSchemaNode(schema, "schema", violations, /* @__PURE__ */ new Set());
	if (violations.length > 0) throw new JsonSchemaError(violations);
}
/** Safely test the lossless JSON boundary when a getter may throw. */
function safelyIsJsonValue(value) {
	try {
		return isJsonValue(value);
	} catch {
		return false;
	}
}
/** Root-aware diagnostic path for the parameter validator's empty sentinel. */
function diagnosticPath(path) {
	return path === "" ? "arguments" : path;
}
/** Append one object property without a leading dot at an implicit root. */
function propertyPath(path, key) {
	return path === "" ? key : `${path}.${key}`;
}
/** The generic exception-containment diagnostic owned by one valid schema node. */
function losslessValueViolation(path) {
	return [`"${diagnosticPath(path)}" must be a lossless JSON value`];
}
/** Append diagnostics without spreading a potentially wide child result as call arguments. */
function appendViolations(target, source) {
	for (const violation of source) target.push(violation);
}
/** Initialize one validation frame with empty aggregation state. */
function valueFrame(node, value, path) {
	return {
		node,
		value,
		path,
		catches: false,
		phase: "start",
		children: [],
		childIndex: 0,
		violations: [],
		tailViolations: [],
		matches: 0
	};
}
/** Validate one scalar node after its primitive type check. */
function checkScalarValue(node, value, path) {
	const allowed = Object.hasOwn(node, "enum") ? node.enum : void 0;
	if (allowed !== void 0 && !allowed.includes(value)) return [`"${diagnosticPath(path)}" must be one of ${JSON.stringify(allowed)}`];
	if (Object.hasOwn(node, "const") && value !== node.const) return [`"${diagnosticPath(path)}" must be ${JSON.stringify(node.const)}`];
	return [];
}
/** Validate one trusted schema/value pair with explicit frames rather than recursive calls. */
function checkValue(schema, value, path) {
	const frames = [valueFrame(schema, value, path)];
	let rootResult;
	const receive = (result) => {
		const parent = frames.at(-1);
		if (parent === void 0) {
			rootResult = result;
			return;
		}
		if (parent.kind === "oneOf") {
			if (result.length === 0) parent.matches++;
		} else appendViolations(parent.violations, result);
	};
	const finish = (result) => {
		frames.pop();
		receive(result);
	};
	while (frames.length > 0) {
		const frame = frames.at(-1);
		/* v8 ignore next -- the loop condition guarantees a current frame. */
		if (frame === void 0) break;
		try {
			if (frame.phase === "children") {
				if (frame.childIndex < frame.children.length) {
					const child = frame.children[frame.childIndex];
					/* v8 ignore next -- childIndex is bounded by children.length. */
					if (child === void 0) throw new Error("missing schema-value child frame");
					frame.childIndex++;
					frames.push(valueFrame(child.node, child.value, child.path));
					continue;
				}
				if (frame.kind === "oneOf") {
					finish(frame.matches === 1 ? [] : [`"${diagnosticPath(frame.path)}" must match exactly one oneOf branch (matched ${frame.matches})`]);
					continue;
				}
				appendViolations(frame.violations, frame.tailViolations);
				if (frame.violations.length > 0) finish(frame.violations);
				else if (frame.kind === "object") finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a lossless JSON object`]);
				else finish(safelyIsJsonValue(frame.value) ? [] : [`"${diagnosticPath(frame.path)}" must be a dense lossless JSON array`]);
				continue;
			}
			const nodeType = Object.hasOwn(frame.node, "type") ? frame.node.type : void 0;
			frame.catches = !(nodeType !== void 0 && !SCHEMA_TYPES.includes(nodeType));
			const oneOf = Object.hasOwn(frame.node, "oneOf") ? frame.node.oneOf : void 0;
			if (oneOf !== void 0) {
				frame.kind = "oneOf";
				frame.children = Array.from(oneOf, (branch) => ({
					node: branch,
					value: frame.value,
					path: frame.path
				}));
				frame.childIndex = 0;
				frame.matches = 0;
				frame.phase = "children";
				continue;
			}
			if (nodeType === void 0) {
				finish(safelyIsJsonValue(frame.value) ? [] : losslessValueViolation(frame.path));
				continue;
			}
			switch (nodeType) {
				case "object": {
					if (!isPlainJsonRecord(frame.value)) {
						finish([`"${diagnosticPath(frame.path)}" must be an object`]);
						break;
					}
					const properties = Object.hasOwn(frame.node, "properties") ? frame.node.properties ?? {} : {};
					const violations = [];
					const required = Object.hasOwn(frame.node, "required") ? frame.node.required ?? [] : [];
					for (const key of required) if (!Object.hasOwn(frame.value, key) || frame.value[key] === void 0) violations.push(`missing required property "${propertyPath(frame.path, key)}"`);
					const children = [];
					for (const [key, child] of Object.entries(properties)) {
						if (!Object.hasOwn(frame.value, key) || frame.value[key] === void 0) continue;
						children.push({
							node: child,
							value: frame.value[key],
							path: propertyPath(frame.path, key)
						});
					}
					const tailViolations = [];
					if (Object.hasOwn(frame.node, "additionalProperties") && frame.node.additionalProperties === false) {
						for (const key of Object.keys(frame.value)) if (!Object.hasOwn(properties, key)) tailViolations.push(`"${propertyPath(frame.path, key)}" is not a declared property (additionalProperties: false)`);
					}
					frame.kind = "object";
					frame.children = children;
					frame.childIndex = 0;
					frame.violations = violations;
					frame.tailViolations = tailViolations;
					frame.phase = "children";
					break;
				}
				case "array": {
					if (!Array.isArray(frame.value)) {
						finish([`"${diagnosticPath(frame.path)}" must be an array`]);
						break;
					}
					const items = Object.hasOwn(frame.node, "items") ? frame.node.items : void 0;
					const children = items === void 0 ? [] : frame.value.flatMap((entry, index) => [{
						node: items,
						value: entry,
						path: `${frame.path}[${index}]`
					}]);
					frame.kind = "array";
					frame.children = children;
					frame.childIndex = 0;
					frame.violations = [];
					frame.phase = "children";
					break;
				}
				case "string":
					finish(typeof frame.value === "string" ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be a string`]);
					break;
				case "number":
					finish(typeof frame.value !== "number" ? [`"${diagnosticPath(frame.path)}" must be a number`] : !isJsonNumber(frame.value) ? [`"${diagnosticPath(frame.path)}" must be a finite JSON number`] : checkScalarValue(frame.node, frame.value, frame.path));
					break;
				case "integer":
					finish(!isJsonNumber(frame.value) || !Number.isInteger(frame.value) ? [`"${diagnosticPath(frame.path)}" must be an integer`] : checkScalarValue(frame.node, frame.value, frame.path));
					break;
				case "boolean":
					finish(typeof frame.value === "boolean" ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be a boolean`]);
					break;
				case "null":
					finish(frame.value === null ? checkScalarValue(frame.node, frame.value, frame.path) : [`"${diagnosticPath(frame.path)}" must be null`]);
					break;
				default: finish(assertNever(nodeType, "JsonSchemaType"));
			}
		} catch (error) {
			let failed = frames.pop();
			while (failed !== void 0 && !failed.catches) failed = frames.pop();
			if (failed === void 0) throw error;
			receive(losslessValueViolation(failed.path));
		}
	}
	/* v8 ignore next -- every root frame finishes or throws. */
	return rootResult ?? losslessValueViolation(path);
}
/**
* Validate a candidate value against an asserted raw schema. The function is
* total for arbitrary values and returns path-qualified violations.
* @param schema - a schema accepted by {@link assertSupportedJsonSchema}.
* @param value - the candidate JSON value.
* @param path - root label used in diagnostics.
* @returns All violations in walk order; empty means valid.
*/
function validateJsonSchemaValue(schema, value, path = "value") {
	return checkValue(schema, value, path);
}
/** Unified JSON-value schema DSL, inference, compilation, and typed tool helper. @module dsh-tools/schema */
const ANNOTATION_KEYS = [
	"description",
	"title",
	"default",
	"examples"
];
/** Throw one author-schema violation through the shared schema error type. */
function authorError(message) {
	throw new JsonSchemaError([message]);
}
/** Copy own annotation fields for validation by the raw-schema boundary. */
function copyAnnotations(source, target) {
	if (Object.hasOwn(source, "description")) target.description = source.description;
	if (Object.hasOwn(source, "title")) target.title = source.title;
	if (Object.hasOwn(source, "default")) target.default = source.default;
	if (Object.hasOwn(source, "examples")) target.examples = source.examples;
}
/** Reject author-only keys outside one node's declared vocabulary. */
function assertAuthorKeys(source, path, allowed) {
	for (const key of Object.keys(source)) if (!allowed.includes(key)) authorError(`${path}.${key} is not supported by the value schema DSL`);
}
/** Install a compiled node without giving `__proto__` assignment semantics. */
function assignCompiledNode(destination, node) {
	switch (destination.kind) {
		case "root":
			destination.holder.value = node;
			break;
		case "property":
			Object.defineProperty(destination.target, destination.key, {
				value: node,
				enumerable: true,
				configurable: true,
				writable: true
			});
			break;
		case "item":
			destination.target.items = node;
			break;
		case "one-of": destination.target[destination.index] = node;
	}
}
/** Install a compiled property map at its root or containing object node. */
function assignCompiledPropertyMap(destination, compiled) {
	if (destination.kind === "root") destination.holder.value = compiled;
	else destination.target.properties = compiled.properties;
}
/** Execute an author-schema compilation task graph without recursive descent. */
function runSchemaCompiler(initial) {
	const seen = /* @__PURE__ */ new Set();
	const tasks = [initial];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (task.kind === "leave") {
			seen.delete(task.input);
			continue;
		}
		if (task.kind === "property-map-tail") {
			if (task.required.length > 0) {
				task.compiled.required = task.required;
				if (task.destination.kind === "object") task.destination.target.required = task.required;
			}
			continue;
		}
		if (task.kind === "property") {
			if (!isJsonSchemaRecord(task.property)) authorError(`${task.path} must be a value schema object`);
			if (Object.hasOwn(task.property, "required") && task.property.required !== true) authorError(`${task.path}.required must be true when present`);
			if (Object.hasOwn(task.property, "required") && task.property.required === true) task.required.push(task.key);
			tasks.push({
				kind: "value",
				input: task.property,
				path: task.path,
				allowRequired: true,
				destination: {
					kind: "property",
					target: task.properties,
					key: task.key
				}
			});
			continue;
		}
		if (task.kind === "property-map") {
			if (!isJsonSchemaRecord(task.input)) authorError(`${task.path} must be an object of value schemas`);
			if (seen.has(task.input)) authorError(`${task.path} is circular`);
			seen.add(task.input);
			const compiled = { properties: {} };
			const required = [];
			assignCompiledPropertyMap(task.destination, compiled);
			tasks.push({
				kind: "leave",
				input: task.input
			});
			tasks.push({
				kind: "property-map-tail",
				compiled,
				required,
				destination: task.destination
			});
			const entries = Object.entries(task.input);
			for (let index = entries.length - 1; index >= 0; index--) {
				const entry = entries[index];
				/* v8 ignore next -- the loop is bounded by the captured entry count. */
				if (entry === void 0) continue;
				tasks.push({
					kind: "property",
					property: entry[1],
					path: `${task.path}.${entry[0]}`,
					key: entry[0],
					properties: compiled.properties,
					required
				});
			}
			continue;
		}
		const { input, path } = task;
		if (!isJsonSchemaRecord(input)) authorError(`${path} must be a value schema object`);
		if (seen.has(input)) authorError(`${path} is circular`);
		seen.add(input);
		const authorKeys = [...ANNOTATION_KEYS, ...task.allowRequired ? ["required"] : []];
		const node = {};
		assignCompiledNode(task.destination, node);
		tasks.push({
			kind: "leave",
			input
		});
		if (Object.hasOwn(input, "oneOf")) {
			assertAuthorKeys(input, path, [
				...authorKeys,
				"oneOf",
				"type"
			]);
			if (Object.hasOwn(input, "type")) authorError(`${path} cannot declare both type and oneOf`);
			if (!isPlainJsonArray(input.oneOf)) authorError(`${path}.oneOf must be an array of at least two value schemas`);
			const branches = [];
			node.oneOf = branches;
			copyAnnotations(input, node);
			for (let index = input.oneOf.length - 1; index >= 0; index--) tasks.push({
				kind: "value",
				input: input.oneOf[index],
				path: `${path}.oneOf[${index}]`,
				allowRequired: false,
				destination: {
					kind: "one-of",
					target: branches,
					index
				}
			});
			continue;
		}
		const inputType = Object.hasOwn(input, "type") ? input.type : void 0;
		switch (inputType) {
			case "json":
				assertAuthorKeys(input, path, [...authorKeys, "type"]);
				copyAnnotations(input, node);
				break;
			case "object":
				assertAuthorKeys(input, path, [
					...authorKeys,
					"type",
					"properties",
					"additionalProperties"
				]);
				if (!Object.hasOwn(input, "additionalProperties") || typeof input.additionalProperties !== "boolean") authorError(`${path}.additionalProperties must be explicitly true or false`);
				node.type = "object";
				copyAnnotations(input, node);
				node.additionalProperties = input.additionalProperties;
				if (Object.hasOwn(input, "properties")) tasks.push({
					kind: "property-map",
					input: input.properties,
					path: `${path}.properties`,
					destination: {
						kind: "object",
						target: node
					}
				});
				break;
			case "array":
				assertAuthorKeys(input, path, [
					...authorKeys,
					"type",
					"items"
				]);
				node.type = "array";
				copyAnnotations(input, node);
				if (Object.hasOwn(input, "items")) tasks.push({
					kind: "value",
					input: input.items,
					path: `${path}.items`,
					allowRequired: false,
					destination: {
						kind: "item",
						target: node
					}
				});
				break;
			case "string":
			case "number":
			case "integer":
			case "boolean":
			case "null":
				assertAuthorKeys(input, path, [
					...authorKeys,
					"type",
					"enum",
					"const"
				]);
				node.type = inputType;
				copyAnnotations(input, node);
				if (Object.hasOwn(input, "enum")) {
					if (!isPlainJsonArray(input.enum)) authorError(`${path}.enum must be a non-empty array of scalar values`);
					node.enum = Array.from(input.enum, (entry) => entry);
				}
				if (Object.hasOwn(input, "const")) node.const = input.const;
				break;
			default: authorError(`${path}.type must be string/number/integer/boolean/null/array/object/json, or use oneOf`);
		}
	}
}
/** Compile one implicit property map, collecting per-property requiredness. */
function compilePropertyMap(input, path) {
	const holder = {};
	runSchemaCompiler({
		kind: "property-map",
		input,
		path,
		destination: {
			kind: "root",
			holder
		}
	});
	/* v8 ignore next -- the root task assigns before scheduling any descendants. */
	return holder.value ?? authorError(`${path} did not compile`);
}
/** Compile one author node without applying any consumer root restriction. */
function compileValueSchema(input, path) {
	const holder = {};
	runSchemaCompiler({
		kind: "value",
		input,
		path,
		allowRequired: false,
		destination: {
			kind: "root",
			holder
		}
	});
	/* v8 ignore next -- the root task assigns before scheduling any descendants. */
	return holder.value ?? authorError(`${path} did not compile`);
}
/**
* Compile one author-facing value schema to the enforced raw JSON Schema
* subset. The author-only `json` node becomes an annotation-only schema.
* @param spec - schema for any JSON-value root.
* @returns The asserted raw schema projection.
*/
function valueSchemaSpecToJsonSchema(spec) {
	const schema = compileValueSchema(spec, "schema");
	assertSupportedJsonSchema(schema);
	return schema;
}
/**
* Compile the implicit open parameter object into raw JSON Schema.
* @param spec - per-property parameter definitions.
* @returns An object-rooted raw schema with no implicit-root openness override.
*/
function parameterSchemaSpecToJsonSchema(spec) {
	const compiled = compilePropertyMap(spec, "parameters");
	const schema = {
		type: "object",
		properties: compiled.properties,
		...compiled.required === void 0 ? {} : { required: compiled.required }
	};
	assertSupportedJsonSchema(schema);
	return schema;
}
/** Invalid model-generated arguments for a typed tool. */
var ToolArgsError = class extends HarnessError {
	/** Individual violations in schema-walk order. */
	violations;
	constructor(violations) {
		super(`invalid arguments: ${violations.join("; ")}`, "INVALID_ARGS");
		this.name = "ToolArgsError";
		this.violations = violations;
	}
};
/**
* Define a first-party tool with inferred arguments and strict execution
* validation. Replay-only presenters validate softly and fall back to generic
* rendering for obsolete logged arguments.
* @param options - typed definition and optional finalizer and presenters.
* @returns A registry-ready definition.
*/
function defineTool(options) {
	const userExecute = options.execute;
	const userFinalizeContent = options.finalizeContent;
	const userRender = options.output.render;
	const userPresentationMeta = options.output.presentationMeta;
	const userPresentCall = options.presentCall;
	const userPresentResult = options.presentResult;
	const userIsConcurrencySafe = options.isConcurrencySafe;
	if (options.timeoutMs !== void 0 && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) throw new Error(`defineTool(${options.name}): timeoutMs must be a positive finite number`);
	const parameters = parameterSchemaSpecToJsonSchema(options.parameters);
	const outputSchema = valueSchemaSpecToJsonSchema(options.output.schema);
	const validate = (args) => validateJsonSchemaValue(parameters, args, "");
	const tool = {
		name: options.name,
		description: options.description,
		parameters,
		output: {
			schema: outputSchema,
			render(args, value) {
				return userRender(args, value);
			},
			...userPresentationMeta !== void 0 ? { presentationMeta(args, value) {
				return userPresentationMeta(args, value);
			} } : {}
		},
		...options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {},
		async execute(args, exec) {
			const violations = validate(args);
			if (violations.length > 0) throw new ToolArgsError(violations);
			return userExecute(args, exec);
		}
	};
	if (userFinalizeContent) tool.finalizeContent = (exec, result) => userFinalizeContent(exec, result);
	if (userPresentCall) tool.presentCall = (args) => {
		if (validate(args).length > 0) return void 0;
		return userPresentCall(args);
	};
	if (userPresentResult) tool.presentResult = (args, result) => {
		if (validate(args).length > 0) return void 0;
		return userPresentResult(args, result);
	};
	if (userIsConcurrencySafe) tool.isConcurrencySafe = (args) => {
		if (validate(args).length > 0) return false;
		return userIsConcurrencySafe(args);
	};
	return tool;
}
/**
* PTC mode `run_code` transport. Programs call the registry's agent-visible
* tools through nested executions scheduled under the native concurrency
* contract; each sub-dispatch is logged for reconstruction, while only the
* outer curated result enters model history.
* @module @deepseek-ai/dsh-tools/src/ptc
*/
/** The model-facing name of the PTC mode tool. */
const RUN_CODE_NAME = "run_code";
/** The `tools:sdk` section order, after per-tool guidance sections. */
const SDK_SECTION_ORDER = FIRST_PARTY_SECTION_ORDER.TOOLS_SDK;
/**
* The TypeScript flavor: the fallback for a schema read with no runtime
* mounted ({@link resolveFlavor} owns which readers reach that). A real
* assembly always resolves a runtime first, so the model never sees this
* fallback outside its own language.
*/
const TYPESCRIPT_FLAVOR = {
	description: "Execute a TypeScript program against the available tools. Takes two required arguments: `code`, the BODY of an async function (erasable syntax only; top-level `await` and `return` work), and `description`, a short summary of what the program does. Call tools as `await tools.name(args)` per the declarations in the system prompt. Only what you print or return is program output — curate it. Image-bearing subtool results are attached after the run.",
	codeDescription: "The program: the body of an async TypeScript function."
};
/** Per-language `run_code` schema flavors (see {@link RunCodeFlavor}); one entry per {@link CodeSdkLanguage}. */
const RUN_CODE_FLAVORS = {
	typescript: TYPESCRIPT_FLAVOR,
	python: {
		description: "Execute a Python program against the available tools. Takes two required arguments: `code`, the BODY of an async function (top-level `await` and `return` work), and `description`, a short summary of what the program does. Call tools as `await tools.name(args)` per the declarations in the system prompt. Use `print(...)` and/or `return <value>` for program output — curate it. Image-bearing subtool results are attached after the run.",
		codeDescription: "The program: the body of an async Python function."
	}
};
/**
* The `description` parameter's model-facing description: language-independent
* (the UI label contract is the same for every runtime), shared between the
* static spec and the language-aware `parameters` getter so the two emissions
* can never drift.
*/
const RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION = "Clear, concise description of what this program does in active voice, 5-10 words (shown in the UI). Examples: \"Count TODO markers across packages\"; \"Read failing test and its fixture\"; \"Rename config key in every cordis.yml\".";
/**
* Resolve the {@link RunCodeFlavor} for the loaded runtime's language, read at
* schema-emission time so the model-visible `run_code` schema always matches
* the SDK section's language. `peekRuntime` returns `undefined` only when no
* runtime is mounted, which reaches this function through definition readers
* and `schemas()` — the doc-catalog harvest is the only shipped one, and none
* of them feeds a model, because `wireSchemas` calls `requireCodeRuntime`
* before projecting — so that path degrades to {@link TYPESCRIPT_FLAVOR}. A
* mounted runtime whose language has no flavor entry fails loud, exactly as
* `requireCodeRuntime` rejects it at assembly. Keeping this table in step with
* `SDK_RENDERERS` is the compiler's job ({@link CodeSdkLanguage}); what this
* guard owns is the runtime-supplied language neither table knows, which never
* yields a wrong-language schema for a real runtime.
*/
function resolveFlavor(peekRuntime) {
	const runtime = peekRuntime();
	if (runtime === void 0) return TYPESCRIPT_FLAVOR;
	const flavor = RUN_CODE_FLAVORS[runtime.language];
	if (!Object.hasOwn(RUN_CODE_FLAVORS, runtime.language) || flavor === void 0) {
		const known = Object.keys(RUN_CODE_FLAVORS).map((name) => JSON.stringify(name)).join(", ");
		throw new Error(`dsh-tools: no run_code schema flavor registered for runtime language ${JSON.stringify(runtime.language)} (known: ${known})`);
	}
	return flavor;
}
/**
* Thrown by `run_code` when the program run itself failed — a program
* exception, a budget expiry, an abort, or substrate death. Extends
* {@link HarnessError} (`code: 'CODE_RUN_FAILED'`); the registry's execution
* pipeline converts it into a structured `isError` result whose text carries
* the failure kind plus the captured logs, so the model can self-correct.
*/
var CodeRunFailedError = class extends HarnessError {
	constructor(message) {
		super(message, "CODE_RUN_FAILED");
		this.name = "CodeRunFailedError";
	}
};
/**
* Snapshot one binding call's argument as lossless JSON, then snapshot that
* detached value again so dispatch and logging stay independent without
* reintroducing structured-clone's platform-specific nesting limit.
*/
function jsonNormalizeArgs(value) {
	let snapshot;
	try {
		snapshot = snapshotJsonValue(value);
	} catch (error) {
		throw new Error(`tool arguments must be lossless JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (snapshot === void 0) throw new Error("tool arguments must be lossless JSON (call the tool with an arguments object, e.g. `{}`)");
	const logged = snapshotJsonValue(snapshot);
	/* v8 ignore next -- snapshot is already a detached lossless JSON value. */
	if (logged === void 0) throw new Error("tool arguments could not be detached for durable logging");
	return {
		dispatched: snapshot,
		logged
	};
}
/** Two-space JSON presentation, matching the existing shallow `run_code` text contract. */
const JSON_INDENT = "  ";
/**
* ECMAScript caps `JSON.stringify`'s `space` string at ten characters. The
* renderer also caps TOTAL indentation there, compacting deeper subtrees, so
* formatted output remains linear in the canonical JSON size.
*/
const MAX_JSON_INDENT_CHARS = 10;
/** Render one non-string JSON root without recursive traversal or unbounded indentation growth. */
function renderJsonValue(value) {
	const chunks = [];
	const tasks = [{
		kind: "value",
		value,
		depth: 0,
		compact: false
	}];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (task.kind === "text") {
			chunks.push(task.text);
			continue;
		}
		const current = task.value;
		if (current === null || typeof current === "boolean" || typeof current === "number") {
			chunks.push(String(current));
			continue;
		}
		if (typeof current === "string") {
			chunks.push(JSON.stringify(current));
			continue;
		}
		const compact = task.compact || (task.depth + 1) * 2 > MAX_JSON_INDENT_CHARS;
		const childDepth = task.depth + 1;
		if (Array.isArray(current)) {
			chunks.push("[");
			if (current.length === 0) {
				chunks.push("]");
				continue;
			}
			tasks.push({
				kind: "text",
				text: compact ? "]" : `\n${JSON_INDENT.repeat(task.depth)}]`
			});
			for (let index = current.length - 1; index >= 0; index--) {
				const item = current[index];
				/* v8 ignore next -- canonical JsonValue arrays are dense. */
				if (item === void 0) throw new Error("cannot render a sparse JSON array");
				tasks.push({
					kind: "value",
					value: item,
					depth: childDepth,
					compact
				});
				tasks.push({
					kind: "text",
					text: compact ? index === 0 ? "" : "," : `${index === 0 ? "\n" : ",\n"}${JSON_INDENT.repeat(childDepth)}`
				});
			}
			continue;
		}
		const keys = Object.keys(current);
		chunks.push("{");
		if (keys.length === 0) {
			chunks.push("}");
			continue;
		}
		tasks.push({
			kind: "text",
			text: compact ? "}" : `\n${JSON_INDENT.repeat(task.depth)}}`
		});
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) throw new Error("cannot render a missing JSON object key");
			const item = current[key];
			/* v8 ignore next -- canonical JsonValue records contain no undefined properties. */
			if (item === void 0) throw new Error("cannot render an undefined JSON object property");
			tasks.push({
				kind: "value",
				value: item,
				depth: childDepth,
				compact
			});
			tasks.push({
				kind: "text",
				text: compact ? `${index === 0 ? "" : ","}${JSON.stringify(key)}:` : `${index === 0 ? "\n" : ",\n"}${JSON_INDENT.repeat(childDepth)}${JSON.stringify(key)}: `
			});
		}
	}
	return chunks.join("");
}
/** Render one present program completion value for the model-facing result text. */
function renderValue(value) {
	return typeof value === "string" ? value : renderJsonValue(value);
}
/**
* Build the `run_code` {@link ToolDefinition}: required `code` and
* `description` parameters, executed through the dispatch bridge described
* above. The
* registry reserves it as presentation infrastructure under non-native modes,
* outside the filterable global/scoped capability layers.
* @param registry - the owning registry (sub-calls go through its `execute`,
*   bindings cover its registered tools).
* @param options - the registry-private capabilities described above.
* @returns the registry-ready definition.
*/
function createRunCodeTool(registry, options) {
	const { requireRuntime, peekRuntime, maxParallel, shapeDispatchLog } = options;
	const definition = defineTool({
		name: RUN_CODE_NAME,
		description: TYPESCRIPT_FLAVOR.description,
		parameters: {
			code: {
				type: "string",
				required: true,
				description: TYPESCRIPT_FLAVOR.codeDescription
			},
			description: {
				type: "string",
				required: true,
				description: RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					logs: {
						type: "array",
						required: true,
						items: { type: "string" }
					},
					result: { type: "json" }
				}
			},
			render: (_args, value) => {
				const rendered = value.result === void 0 ? "" : renderValue(value.result);
				const parts = [value.logs.join("\n"), rendered].filter((part) => part.length > 0);
				return [{
					type: "text",
					text: parts.length > 0 ? parts.join("\n") : "(run_code completed with no output)"
				}];
			}
		},
		async execute(args, exec) {
			if (args.description.trim().length === 0) throw new Error("invalid description: expected a non-empty string");
			const runtime = requireRuntime();
			const runController = new AbortController();
			const onOuterAbort = () => {
				runController.abort(exec.signal.reason);
			};
			exec.signal.addEventListener("abort", onOuterAbort, { once: true });
			let dispatches = 0;
			const pendingQueue = [];
			const inFlight = /* @__PURE__ */ new Set();
			/** Tracked settle-event side work (log-content listener + append), drained at run settlement. */
			const logWork = /* @__PURE__ */ new Set();
			const commitQueue = [];
			let exclusiveActive = false;
			let driving = false;
			let driverRun = Promise.resolve();
			let wake;
			const wakeup = () => {
				const release = wake;
				wake = void 0;
				release?.();
			};
			/**
			* The single ordered lane. Each pass commits the head-of-line settled
			* dispatch (ordered post-execute), then starts the next queued entry if
			* its slot is free (ordered pre-execute), and otherwise sleeps until a
			* body settles or a new submission arrives. One run reaching the
			* empty-queues/empty-pool state is quiescence.
			*/
			const drive = () => {
				if (driving) return driverRun;
				driving = true;
				driverRun = (async () => {
					try {
						for (;;) {
							const signal = new Promise((resolve) => {
								wake = resolve;
							});
							const commitHead = commitQueue[0];
							if (commitHead !== void 0 && commitHead.settled) {
								commitQueue.shift();
								await commitHead.commit();
								if (commitHead.mode === "exclusive") exclusiveActive = false;
								continue;
							}
							const head = pendingQueue[0];
							if (head !== void 0) {
								if (runController.signal.aborted) {
									pendingQueue.shift();
									head.abandon();
									continue;
								}
								const mode = head.classify();
								if (!exclusiveActive && (mode === "exclusive" ? inFlight.size === 0 : inFlight.size < maxParallel)) {
									if (mode === "exclusive") exclusiveActive = true;
									head.mode = mode;
									pendingQueue.shift();
									commitQueue.push(head);
									await head.start();
									const flight = head.flight.finally(() => {
										inFlight.delete(flight);
										wakeup();
									});
									inFlight.add(flight);
									continue;
								}
							}
							if (pendingQueue.length === 0 && commitQueue.length === 0 && inFlight.size === 0) return;
							await signal;
						}
					} finally {
						driving = false;
						wake = void 0;
					}
				})();
				return driverRun;
			};
			/** Every dispatch settled AND committed; nothing can start (the run is aborted at call time). */
			const drainDispatches = async () => {
				await drive();
				while (logWork.size > 0) await Promise.allSettled([...logWork]);
			};
			const runOver = () => runController.signal.aborted;
			const binding = (name) => async (rawArgs) => {
				if (runOver()) throw new Error(`run_code run is over (${String(runController.signal.reason)}); ${name} not dispatched`);
				const normalized = jsonNormalizeArgs(rawArgs);
				const n = ++dispatches;
				const subCallId = ToolCallId(`${String(exec.callId)}:code:${n}`);
				const input = {
					callId: subCallId,
					rootCallId: exec.rootCallId,
					name,
					arguments: normalized.dispatched,
					...exec.agent ? { agent: exec.agent } : {},
					parent: exec.token,
					signal: runController.signal
				};
				const scheduler = registry[TOOL_RUNTIME_SCHEDULER];
				const outcome = await new Promise((resolve, reject) => {
					let parked;
					const settle = (result) => {
						resolve(result.isError ? {
							isError: true,
							message: result.error.message
						} : {
							isError: false,
							value: result.value
						});
						const agent = exec.agent;
						if (agent === void 0) return;
						const task = (async () => {
							const logged = await shapeDispatchLog({
								exec,
								agent,
								subCallId,
								name,
								isError: result.isError,
								content: result.content
							});
							agent.session.append("tool/code-dispatch", {
								rootCallId: exec.rootCallId,
								parentCallId: exec.callId,
								subCallId,
								name,
								arguments: normalized.logged,
								isError: result.isError,
								content: logged
							});
						})().finally(() => {
							logWork.delete(task);
						});
						logWork.add(task);
					};
					pendingQueue.push({
						flight: Promise.resolve(),
						settled: false,
						classify: () => registry.executionMode(input).kind,
						abandon: () => {
							reject(/* @__PURE__ */ new Error(`run_code run is over (${String(runController.signal.reason)}); ${name} tool call abandoned`));
						},
						async start() {
							exec.agent?.session.append("tool/code-dispatch-start", {
								rootCallId: exec.rootCallId,
								parentCallId: exec.callId,
								subCallId,
								name,
								arguments: normalized.logged
							});
							const prepared = await scheduler.prepare(input);
							if (prepared.kind === "dispatch") {
								this.flight = scheduler.dispatch(prepared.exec).then((dispatchOutcome) => {
									parked = {
										kind: dispatchOutcome.kind,
										exec: prepared.exec,
										result: dispatchOutcome.result
									};
									this.settled = true;
								});
								return;
							}
							parked = {
								kind: prepared.kind,
								exec: prepared.exec,
								result: prepared.result
							};
							this.settled = true;
						},
						async commit() {
							/* v8 ignore next -- commit() runs only after `settled` flipped, which set parked. */
							if (parked === void 0) return;
							const result = parked.kind === "post-result" ? await scheduler.finalize(parked.exec, parked.result) : scheduler.finish(parked.exec, parked.result);
							if (!result.isError && result.content.some((block) => block.type === "image")) exec.deferContext(createUserMessage({
								content: result.content,
								source: {
									kind: "plugin",
									plugin: "tools-code-mode"
								}
							}));
							for (const context of result.additionalContexts ?? []) exec.deferContext(context);
							if (result.concludesTurn) exec.concludeTurn();
							settle(result);
							while (logWork.size > maxParallel) await Promise.race(logWork);
						}
					});
					wakeup();
					drive();
				});
				if (runOver()) throw new Error(`run_code run is over (${String(runController.signal.reason)}); ${name} result discarded`);
				if (outcome.isError) throw new Error(outcome.message);
				return outcome.value;
			};
			const functions = Object.create(null);
			for (const schema of registry.schemas(exec.agent)) {
				if (schema.name === "run_code") continue;
				Object.defineProperty(functions, schema.name, {
					enumerable: true,
					value: binding(schema.name)
				});
			}
			try {
				let result;
				try {
					result = await runtime.run({
						program: args.code,
						bindings: [{
							global: "tools",
							functions,
							errorClass: {
								name: "ToolCallError",
								memberNameProperty: "toolName"
							}
						}],
						signal: runController.signal
					});
				} finally {
					runController.abort("run_code settled");
					await drainDispatches();
				}
				if (result.error) {
					const logsText = result.logs.length > 0 ? `\nCaptured output:\n${result.logs.join("\n")}` : "";
					throw new CodeRunFailedError(`code run failed (${result.error.kind}): ${result.error.message}${logsText}`);
				}
				return {
					logs: result.logs,
					...result.value !== void 0 ? { result: result.value } : {}
				};
			} finally {
				exec.signal.removeEventListener("abort", onOuterAbort);
			}
		},
		presentCall: (args) => ({
			card: "generic",
			title: args.description,
			kind: "execute",
			rawInput: args.code
		})
	});
	Object.defineProperty(definition, "description", {
		enumerable: true,
		get: () => resolveFlavor(peekRuntime).description
	});
	Object.defineProperty(definition, "parameters", {
		enumerable: true,
		get: () => parameterSchemaSpecToJsonSchema({
			code: {
				type: "string",
				required: true,
				description: resolveFlavor(peekRuntime).codeDescription
			},
			description: {
				type: "string",
				required: true,
				description: RUN_CODE_DESCRIPTION_PARAM_DESCRIPTION
			}
		})
	});
	return definition;
}
/**
* PTC mode codegen: the pure projection from registered tool schemas to the TypeScript SDK
* text the model programs against (the `tools:sdk` prompt section). Sibling of
* `json-schema.ts` — `schemas()` (native function calling) and this module (the generated
* `declare const tools` API) are two projections of the same store.
* @module @deepseek-ai/dsh-tools/src/ts-types
*/
/** Property names that are valid bare TS identifiers; anything else is quoted. */
const IDENTIFIER$1 = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
/** Render an object key: bare when it is a valid identifier, quoted otherwise (every name stays reachable, no aliasing). */
function renderKey(name) {
	return IDENTIFIER$1.test(name) ? name : JSON.stringify(name);
}
/** One `indent`-deep line prefix (two spaces per level). */
function pad$1(indent) {
	return "  ".repeat(indent);
}
/** A one-line JSDoc block for a schema `description`, or no lines when there is none. */
function docLines$1(description, indent) {
	if (typeof description !== "string" || description.length === 0) return [];
	const collapsed = description.replace(/\s+/g, " ").trim();
	return [`${pad$1(indent)}/** ${collapsed.replaceAll("*/", String.raw`*\/`)} */`];
}
/** Render one scalar already validated by the unified schema boundary. */
function renderScalar(value) {
	return JSON.stringify(value);
}
/** Render a validated scalar `const`/`enum`, falling back to the broad type. */
function renderConstrainedScalar$1(node, type) {
	const broad = type === "integer" ? "number" : type;
	if (Object.hasOwn(node, "const")) return renderScalar(node.const);
	if (Object.hasOwn(node, "enum")) return node.enum.map(renderScalar).join(" | ");
	return broad;
}
/** Build one document from captured parts while retaining the legacy array-parenthesization test. */
function typeDocumentFrom(parts) {
	return {
		parts,
		containsUnionOrIntersection: parts.some((part) => typeof part === "string" ? part.includes("|") || part.includes("&") : part.containsUnionOrIntersection)
	};
}
/** Build a small document without an intermediate array at each call site. */
function typeDocument(...parts) {
	return typeDocumentFrom(parts);
}
/** Flatten a nested document with an explicit work stack. */
function flattenTypeDocument(document) {
	const chunks = [];
	const tasks = [document];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (typeof task === "string") {
			chunks.push(task);
			continue;
		}
		for (let index = task.parts.length - 1; index >= 0; index--) {
			const part = task.parts[index];
			/* v8 ignore next -- the loop is bounded by the captured part count. */
			if (part !== void 0) tasks.push(part);
		}
	}
	return chunks.join("");
}
/** Initialize one schema-render frame with empty aggregation state. */
function schemaRenderFrame(node, indent) {
	return {
		node,
		indent,
		phase: "start",
		children: [],
		childIndex: 0,
		childDocuments: [],
		entries: []
	};
}
/** Render an already asserted schema to a composable document. */
function renderSupportedSchema(schema, indent) {
	const frames = [schemaRenderFrame(schema, indent)];
	let rootDocument;
	const finish = (document) => {
		frames.pop();
		const parent = frames.at(-1);
		if (parent === void 0) rootDocument = document;
		else parent.childDocuments.push(document);
	};
	while (frames.length > 0) {
		const frame = frames.at(-1);
		/* v8 ignore next -- the loop condition guarantees a current frame. */
		if (frame === void 0) break;
		if (frame.phase === "children") {
			if (frame.childIndex < frame.children.length) {
				const child = frame.children[frame.childIndex];
				/* v8 ignore next -- childIndex is bounded by children.length. */
				if (child === void 0) throw new Error("missing schema render child");
				frame.childIndex++;
				frames.push(schemaRenderFrame(child.node, child.indent));
				continue;
			}
			if (frame.kind === "oneOf") {
				const parts = [];
				for (let index = 0; index < frame.childDocuments.length; index++) {
					if (index > 0) parts.push(" | ");
					const child = frame.childDocuments[index];
					/* v8 ignore next -- child documents correspond one-to-one with children. */
					if (child !== void 0) parts.push(child);
				}
				finish(typeDocumentFrom(parts));
				continue;
			}
			if (frame.kind === "array") {
				const child = frame.childDocuments[0];
				/* v8 ignore next -- array frames always schedule exactly one child. */
				if (child === void 0) throw new Error("missing array item type");
				finish(child.containsUnionOrIntersection ? typeDocument("(", child, ")[]") : typeDocument(child, "[]"));
				continue;
			}
			const required = new Set(frame.node.required);
			const parts = ["{"];
			for (let index = 0; index < frame.entries.length; index++) {
				const entry = frame.entries[index];
				const child = frame.childDocuments[index];
				/* v8 ignore next -- object entries and child documents have the same length. */
				if (entry === void 0 || child === void 0) throw new Error("missing object property type");
				const [name, prop] = entry;
				for (const line of docLines$1(prop.description, frame.indent + 1)) parts.push("\n", line);
				parts.push("\n", `${pad$1(frame.indent + 1)}${renderKey(name)}${required.has(name) ? "" : "?"}: `, child, ";");
			}
			parts.push("\n", `${pad$1(frame.indent)}}`);
			const declared = typeDocumentFrom(parts);
			finish(frame.node.additionalProperties === false ? declared : typeDocument(declared, " & Record<string, JsonValue>"));
			continue;
		}
		const node = frame.node;
		if (node.oneOf !== void 0) {
			frame.kind = "oneOf";
			frame.children = Array.from(node.oneOf, (child) => ({
				node: child,
				indent: frame.indent
			}));
			frame.childIndex = 0;
			frame.childDocuments = [];
			frame.phase = "children";
			continue;
		}
		if (node.type === void 0) {
			finish(typeDocument("JsonValue"));
			continue;
		}
		switch (node.type) {
			case "string":
			case "number":
			case "integer":
			case "boolean":
			case "null":
				finish(typeDocument(renderConstrainedScalar$1(node, node.type)));
				break;
			case "array":
				if (node.items === void 0) finish(typeDocument("JsonValue[]"));
				else {
					frame.kind = "array";
					frame.children = [{
						node: node.items,
						indent: frame.indent
					}];
					frame.childIndex = 0;
					frame.childDocuments = [];
					frame.phase = "children";
				}
				break;
			case "object": {
				const open = node.additionalProperties !== false;
				const entries = Object.entries(node.properties ?? {});
				if (entries.length === 0) finish(typeDocument(open ? "Record<string, JsonValue>" : "Record<string, never>"));
				else {
					frame.kind = "object";
					frame.entries = entries;
					frame.children = entries.map(([, child]) => ({
						node: child,
						indent: frame.indent + 1
					}));
					frame.childIndex = 0;
					frame.childDocuments = [];
					frame.phase = "children";
				}
				break;
			}
			/* v8 ignore next -- assertSupportedJsonSchema narrowed this closed type union. */
			default: finish(typeDocument("unknown"));
		}
	}
	/* v8 ignore next -- every root frame produces one document. */
	return rootDocument ?? typeDocument("unknown");
}
/**
* Map one enforced JSON-Schema node to a TypeScript type literal. Supports
* every unified schema construct and returns `unknown` for malformed or
* unsupported inputs without throwing.
* @param schema - the JSON-Schema node (any shape; hostile inputs degrade).
* @param indent - the indentation level for nested object members.
* @returns the TS type text (multi-line for objects with properties).
*/
function jsonSchemaToTs(schema, indent = 0) {
	try {
		assertSupportedJsonSchema(schema);
		return flattenTypeDocument(renderSupportedSchema(schema, indent));
	} catch {
		return "unknown";
	}
}
/** The fixed model-facing usage contract rendered above the declarations (see the PTC mode Agent Note's "What the model sees"). */
const SDK_INSTRUCTIONS$1 = `## Writing code for run_code

\`run_code\` takes two required arguments: \`code\` — the body of an async TypeScript function (erasable syntax only — no \`enum\` or namespaces; type annotations are advisory, the code runs type-stripped) — and \`description\`, a short summary of what the program does. The declarations below are SDK bindings for this program. A declaration does not make its name a directly callable tool; only names supplied as separate tool schemas may be called directly.`;
const SDK_PROGRAM_INSTRUCTIONS = `Inside the program:

- Call tools as \`await tools.name(args)\` — quoted access for exotic names: \`tools["my-tool"](args)\`. Every call resolves to the tool's typed canonical JSON value. Tool arguments must be lossless JSON.
- A FAILED tool call rejects with \`ToolCallError\`, whose \`toolName\` identifies the failed tool and whose \`message\` is human-readable — \`try/catch\` it to handle and continue.
- Independent read-only calls MAY overlap under \`Promise.all\` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with \`await\`.
- Emit results with \`return\` and/or \`console.log(...)\`. Only what you print or return is program output. A successful tool result containing an image is attached after the run so you can inspect it on the next step; every other intermediate result stays out of the conversation, so extract just what you need.

Program-only SDK bindings:`;
/** Whether one string schema accepts the literal used by the bash example. */
function acceptsExampleString(schema, value) {
	return schema?.type === "string" && (schema.const === void 0 || schema.const === value) && (schema.enum === void 0 || schema.enum.includes(value));
}
/** Render the bash example only when its literal arguments satisfy the current parameter schema. */
function renderBashExample(schemas) {
	const bash = schemas.find((schema) => schema.name === "bash");
	if (bash === void 0) return "";
	const parameters = bash.parameters;
	if (parameters.type !== "object") return "";
	const required = parameters.required ?? [];
	if (required.some((name) => name !== "command" && name !== "description")) return "";
	if (!acceptsExampleString(parameters.properties?.command, "pwd")) return "";
	const needsDescription = required.includes("description");
	if (needsDescription && !acceptsExampleString(parameters.properties?.description, "Show current directory")) return "";
	return ` When no separate \`bash\` schema is supplied, invoke a declared \`bash\` binding inside \`run_code\`:\n\n\`run_code({ code: "return await tools.bash({ command: 'pwd'${needsDescription ? ", description: 'Show current directory'" : ""} })", description: "Show current directory" })\``;
}
/**
* Render the full `tools:sdk` prompt section: the fixed usage instructions
* plus one `declare const tools` interface covering every given tool.
* Deterministic — tools are emitted in lexicographic name order, so an
* unchanged tool set produces byte-identical text across assemblies. The sort
* is not a total order on byte-equal names, so two schemas sharing a name
* would render in argument order; the caller's visible-capability map is keyed
* by name, so the input never carries a duplicate.
* @param schemas - the tool schemas to declare (the caller excludes
*   `run_code` itself).
* @returns the complete section text.
*/
function renderToolsSdk(schemas) {
	const sorted = [...schemas].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
	const argsMembers = [];
	const outputMembers = [];
	for (const schema of sorted) {
		argsMembers.push(...docLines$1(schema.description, 1));
		argsMembers.push(`${pad$1(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.parameters, 1)};`);
		outputMembers.push(`${pad$1(1)}${renderKey(schema.name)}: ${jsonSchemaToTs(schema.output, 1)};`);
	}
	const declaration = [
		`interface ToolArgsMap {${argsMembers.length > 0 ? `\n${argsMembers.join("\n")}\n` : ""}}`,
		`interface ToolOutputMap {${outputMembers.length > 0 ? `\n${outputMembers.join("\n")}\n` : ""}}`,
		"type ToolName = keyof ToolOutputMap",
		[
			"declare class ToolCallError extends Error {",
			"  readonly name: \"ToolCallError\";",
			"  readonly toolName: ToolName;",
			"}"
		].join("\n"),
		[
			"declare const tools: {",
			"  [K in ToolName]: (args: ToolArgsMap[K]) => Promise<ToolOutputMap[K]>;",
			"}"
		].join("\n")
	].join("\n\n");
	return `${SDK_INSTRUCTIONS$1}${renderBashExample(sorted)}\n\n${SDK_PROGRAM_INSTRUCTIONS}\n\n\`\`\`ts\ntype JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }\n\n${declaration}\n\`\`\``;
}
/**
* PTC mode codegen — Python flavor. The pure projection from registered tool schemas to the
* Python SDK text the model programs against under `runtime.language === 'python'`. Sibling of
* {@link ./ts-types.ts | ts-types.ts}; the two files are two projections of the same registry
* store, keyed by the loaded {@link @deepseek-ai/dsh-code-runtime#CodeRuntime.language | code
* runtime's language}.
*
* Under `mode: 'ptc'` the native tool schemas are omitted from the request, so this generated
* SDK is the model's ONLY source for each tool's argument names, required fields, types,
* descriptions, and canonical output shapes; under `mode: 'both'` the native schemas ship
* alongside it and it is one of two. Object-shaped arguments and outputs therefore render as one
* named `TypedDict` per tool (and per nested object), not an opaque `dict[str, Any]`, so the
* shape survives into the program under the mode that has nothing else to carry it.
* @module @deepseek-ai/dsh-tools/src/py-types
*/
/**
* The reference grammar's `xid_start xid_continue*` — the set
* `str.isidentifier()` accepts on a CPython whose Unicode tables match the
* engine's. See {@link isBareIdentifier} for what a version skew does.
*/
const IDENTIFIER = /^[\p{XID_Start}_]\p{XID_Continue}*$/u;
/**
* Whether a name can be emitted as a bare Python identifier rather than
* routed to the subscript/`dict[str, Any]` path.
*
* Python identifiers are not ASCII: `路径` is as legal a field name as `path`,
* and rejecting it would degrade the whole enclosing object, dropping every
* field's name, requiredness, and type — information whose only source under
* `mode: 'ptc'` is this generated text.
*
* NFKC stability is a second and separate condition, because CPython
* normalizes identifiers at compile time while JSON keys are compared as
* written: `ﬁeld` would be declared and reachable as `field`, so the SDK would
* advertise a key under a spelling the harness never accepts, and two keys
* that normalize together would collapse into one declaration. Those names
* take the subscript path, which carries their exact bytes.
*
* `IDENTIFIER` matches `str.isidentifier()` (measured on Node 22.23.1 vs
* CPython 3.9.6 tables): the equivalence holds inside the two versions' shared
* tables, and the skew characters below are exactly where that pair diverges.
* The predicate as a whole is deliberately stricter than `isidentifier()`,
* which does not test NFKC stability: `'ﬁeld'.isidentifier()` is True and
* this returns false.
*
* Both conditions are evaluated against the ENGINE's Unicode tables, and the
* two sides are versioned independently — `\p{XID_Start}`/`\p{XID_Continue}`
* follow the running engine (Node 22.23.1 reports Unicode 17.0) while CPython
* follows its own (3.9.6 reports 13.0.0). The skew is not symmetric. A CPython
* older than the engine is the dangerous direction: a character added to either
* property since its tables (U+10570 Vithkuqi and U+1E290 Toto, 14.0; U+1E4D0
* Nag Mundari, 15.0; U+1C89 Cyrillic TJE, 16.0 — ages per `DerivedAge.txt`; all
* four are NFKC-stable and accepted here, and all four are `Cn` on that 3.9.6,
* which rejects them) is emitted bare and its tokenizer refuses the character,
* taking the whole SDK block down — the same parseability invariant
* {@link UNPRINTABLE}, {@link LONE_SURROGATE} and {@link MAX_LIST_NESTING}
* exist for. Both properties carry it: a character added only to `XID_Continue`
* passes the trailing `\p{XID_Continue}*` in a tail position and fails the same
* way — U+200C ZWNJ and U+200D ZWJ are that case, gaining `XID_Continue` in UCD
* 15.1 and absent from it in 13.0.0, 14.0.0 and 15.0.0, so `a\u{200C}b` is
* emitted bare here while `isidentifier()` is False on 3.9.6 and on 3.12.13
* (15.0.0). A CPython newer than the engine only routes a legal name to the
* subscript/`dict[str, Any]` path: less readable, still correct. The NFKC
* condition reduces to the same skew, since normalization stability guarantees
* an assigned character's normalization never changes afterwards.
*
* This predicate is not the only reader of engine tables. {@link camelCase}
* reads them at three further points — its split set, its head test, and its
* `toUpperCase()` case mapping — and this predicate's verdict gates none of
* them: a class name derived there reaches emitted text whenever any object
* shape in the tool's schema declares a `TypedDict`, including for a tool this
* predicate rejected. A tool named `zz-\u{1E4D0}x` with such parameters never
* reaches the skew here (the `-` rejects it outright) yet emits `class
* Zz\u{1E4D0}xArgs`, which that same 3.9.6 refuses — Nag Mundari arrived two
* releases after its tables. The case mapping is a separate table rather than
* an XID membership test, and it fails on names both conditions above accept:
* `\u{019B}` is XID_Start and NFKC-stable, so this predicate accepts it and
* `async def \u{019B}` compiles on 3.9.6, but Node uppercases it to
* `\u{A7DC}` — unassigned in that CPython, whose own `.upper()` is the identity
* here — and the declared `class \u{A7DC}Args` fails with `invalid
* non-printable character U+A7DC`. Closing the exposure therefore covers all
* four read points, not this predicate alone; it needs the target interpreter's
* version, which the backend reporting `language: 'python'` owns; the
* language-dispatch Agent Note records the deferral.
*
* The `ts-types` sibling keeps its own ASCII rule rather than sharing this
* one: ECMAScript identifiers are a different set (`$`) and are never
* normalized, so one predicate cannot be correct for both. ZWJ/ZWNJ are not
* part of that difference — both sets carry them on the engine's tables; what
* separates the two there is the CPython table version above.
* @param name - the raw schema field or tool name.
* @returns whether the name can be emitted bare.
*/
function isBareIdentifier(name) {
	return IDENTIFIER.test(name) && name.normalize("NFKC") === name;
}
/**
* Python hard keywords: reserved everywhere, so a tool or field named
* ``class`` or ``lambda`` is legal on the wire but not as an attribute
* (``tools.class`` would be a SyntaxError in the model program) and not as a
* class-syntax `TypedDict` field. Such a tool renders under subscript access
* and such an object degrades to ``dict[str, Any]`` — the model still reaches
* every tool and field without collisions.
* Soft keywords (``match``, ``case``, ``type``, ``_`` — the language
* reference's whole set) are deliberately ABSENT: each is special in exactly
* one syntactic position — a statement head (``match``, ``type``), a ``match``
* statement's clause head (``case``), or a pattern (``_``) — so ``match: str``
* as a field and ``async def match(...)`` as a method are both legal, and
* including them would needlessly degrade common search/regex tool fields to
* ``dict[str, Any]``. Underscore-leading names are handled separately, not
* here: a non-dunder ``__token`` name-mangles, a dunder present on
* ``object``/``type`` resolves before the proxy hook, and implicit
* special-method lookup bypasses the hook.
*/
const RESERVED = /* @__PURE__ */ new Set([
	"False",
	"None",
	"True",
	"and",
	"as",
	"assert",
	"async",
	"await",
	"break",
	"class",
	"continue",
	"def",
	"del",
	"elif",
	"else",
	"except",
	"finally",
	"for",
	"from",
	"global",
	"if",
	"import",
	"in",
	"is",
	"lambda",
	"nonlocal",
	"not",
	"or",
	"pass",
	"raise",
	"return",
	"try",
	"while",
	"with",
	"yield",
	"__debug__"
]);
/** `typing` symbols this module may emit, in the deterministic import order. */
const TYPING_ORDER = [
	"Any",
	"Literal",
	"NotRequired",
	"Protocol",
	"TypedDict"
];
/** `indent`-deep line prefix (four spaces per level to match PEP 8 output). */
function pad(indent) {
	return "    ".repeat(indent);
}
/**
* The `Cc` code points that survive the whitespace collapse in {@link describe}
* and have no printable form: the C0 controls, DEL, and the C1 controls. Only
* U+0009 to U+000D are absent, because ECMAScript `\s` already collapsed them —
* `\s` is TAB/VT/FF/SP/NBSP/ZWNBSP/Zs plus LF/CR/LS/PS, so no C1 code point is
* in it and the whole U+0080 to U+009F block reaches this rule intact. Those
* are not hypothetical input: they are what Windows-1252 bytes 0x80 to 0x9F
* (smart quotes, em dash) become when decoded as Latin-1.
* CPython rejects source containing a NUL outright
* (`SyntaxError: source code string cannot contain null bytes`), whether it
* sits in a docstring or in a comment, so one such byte anywhere in a schema
* description would make the whole generated SDK unparseable — under
* `mode: 'ptc'`, the model's only declaration of the tools. The rest are
* legal but invisible; escaping them with the same rule keeps the emitted text
* readable and the treatment uniform.
*
* The boundary is the category, not per-code-point addressability: `\xNN`
* addresses U+0000 to U+00FF, so one escape form covers `Cc` exactly. The
* invisible `Cf` formatting characters pass through by design — of them only
* U+00AD soft hyphen would fit `\xNN` at all, and escaping that one while
* U+200B ZWSP, U+200E/U+200F bidi marks, and U+2060 word joiner passed through
* would leave a rule that is neither category- nor addressability-shaped. The
* whole family is legal in both consumers, since only LF and CR terminate a
* Python string literal or a `#` comment. That set is the tokenizer's, not
* `str.splitlines()`': NEL (U+0085), LS (U+2028), and PS (U+2029) split a
* string at run time but do not end a physical line in source — measured on
* CPython 3.9.6 and 3.12.13, each accepted in both positions with the value
* round-tripping — so they are safe raw wherever they reach emitted text
* unescaped, which for all three is `JSON.stringify`, at two call sites:
* {@link pyScalar}'s literal path, and the subscript tool-name comment's own
* call, which a name carrying any of them always reaches, none being
* `XID_Continue`. The `description` path escapes NEL under the class above and
* folds LS and PS in {@link describe}'s `\s+` collapse, both being `\s`.
*/
const UNPRINTABLE = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g;
/**
* Unpaired surrogate code points, escaped by {@link describe} as `\uNNNN` —
* its own form, since `\xNN` stops at U+00FF. The `u` flag is what makes this
* the LONE ones: in Unicode mode a well-formed pair is a single astral code
* point outside D800 to DFFF, so an emoji in a description survives untouched.
*
* This is the NUL case from {@link UNPRINTABLE}, not the invisible-character
* case. Python source must be UTF-8-encodable and a lone surrogate is not, so
* `compile()` raises `UnicodeEncodeError: surrogates not allowed` for one
* anywhere in the text — measured on 3.9 for a string literal and for a `#`
* comment alike. A raw or MCP tool description reaches this: `JSON.parse` on a
* wire `"\ud800"` escape yields exactly such a code point.
*/
const LONE_SURROGATE = /[\ud800-\udfff]/gu;
/**
* The collapsed one-line `description` of a schema node (byte-stable across
* formatting churn), or `undefined` when the node carries none. Every caller
* passes an object — a validated property node, the `ToolSdkSchema` itself, or
* the `{ description }` wrapper {@link docLines} synthesizes — so only the
* description field needs guarding. A description that collapses
* to nothing (empty, or whitespace only) is `undefined` too: it documents the
* node no better than an absent one, and emitting it would leave an empty
* `"""` docstring or a bare `#   ` line in the SDK. Only ECMAScript whitespace
* folds, so a description of whitespace plus one surviving control character is
* NOT absent: it collapses to that character's visible escape.
*
* Control characters left over after the whitespace collapse are rendered as
* their `\xNN` escapes (see {@link UNPRINTABLE}) and unpaired surrogates as
* their `\uNNNN` escapes (see {@link LONE_SURROGATE}); the escape's own backslash is
* emitted literally by both consumers, since {@link docLines} doubles it into a
* Python source escape and a `#` comment carries it verbatim.
*/
function describe(schema) {
	const description = schema.description;
	if (typeof description !== "string") return void 0;
	const collapsed = description.replace(/\s+/g, " ").replace(UNPRINTABLE, (char) => `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`).replace(LONE_SURROGATE, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`).trim();
	return collapsed.length === 0 ? void 0 : collapsed;
}
/**
* One-line docstring for a tool `description`, or no lines when there is none.
* Backslashes are doubled first, every quote is escaped, and a trailing
* backslash cannot survive: a description ending in `"` or an odd backslash
* would otherwise merge with (or escape) the closing triple quote and make
* the generated block — PTC mode's only SDK — syntactically invalid Python.
*/
function docLines(description, indent) {
	const collapsed = describe({ description });
	if (collapsed === void 0) return [];
	const escaped = collapsed.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
	return [`${pad(indent)}"""${escaped}"""`];
}
/**
* CamelCase a name into a Python type identifier: non-identifier characters
* split words, `_` splits too (it is `XID_Continue`, so the split set names it
* explicitly), and a head that cannot start an identifier takes a `Tool`
* prefix. Unicode survives, so a `路径` field yields `路径`-based class names
* instead of collapsing to the bare prefix. A character that is not
* `XID_Continue` splits even when it is a letter, so a name whose NFKC folding
* would leave the identifier set is not carried through — the split set is the
* grammar's, not an ASCII approximation of it.
*
* The result is NFKC-normalized: these names are generated, never matched
* against a JSON key, so normalizing is free here and keeps what CPython
* compiles identical to what is emitted — unlike {@link isBareIdentifier},
* which must reject unstable names outright. Normalizing AFTER the prefix
* decision is what makes that hold at the seam the prefix creates: `Tool` +
* a combining-mark head composes there (`U+0301` gives `Tooĺ`, U+013A), so
* normalizing only the un-prefixed part would emit a name CPython compiles to
* a different symbol. The second call is idempotent on the un-prefixed arm.
*
* The split set, the head test, and `toUpperCase()` all read the engine's
* Unicode tables, so this function carries the same version skew
* {@link isBareIdentifier} documents, by paths independent of it: a class name
* derived here reaches emitted text whenever any object shape in the tool's
* schema declares a `TypedDict`, and the predicate's verdict on the tool name
* does not gate that. The case mapping is the one that can fail on a name the
* predicate accepted; the worked example is there.
* @param raw - the schema field or tool name to derive from.
* @returns a class-name segment safe to emit.
*/
function camelCase(raw) {
	const joined = raw.split(/[^\p{XID_Continue}]+|_+/u).filter((part) => part.length > 0).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("").normalize("NFKC");
	return (/^\p{XID_Start}/u.test(joined) ? joined : `Tool${joined}`).normalize("NFKC");
}
/** Class-name base cap keeping each emitted name — and total text — linear in schema depth. */
const MAX_CLASS_NAME_BASE = 120;
/**
* Deepest `list[…]` nesting emitted into one annotation before the item type
* degrades to `Any`. CPython's tokenizer rejects a logical line holding more
* than 200 simultaneously-open brackets (`MAXLEVEL`, `SyntaxError: too many
* nested parentheses`), so an array chain deeper than that would render an SDK
* block that is not valid Python at all — the same failure the docstring
* escaping in {@link docLines} exists to prevent. 180 leaves headroom for the
* few brackets an annotation can add around the chain, all of which count
* toward the same limit. Per emission site, counting brackets open at the
* chain's innermost point:
*
* - Return annotation, `async def f(self, args: X) -> chain:` — 180 `list[`
*   plus an innermost `Literal[`. The parameter list's `(` closed at the `)`
*   before the `->`, so it is NOT open here: 181.
* - TypedDict field, `field: NotRequired[chain]` — a class-body line with no
*   other open bracket, and its children start at `listDepth: 1` to reserve
*   the `NotRequired[`, so 179 `list[` plus `Literal[`: 181. Required fields
*   share that start for uniformity, spending one level of representable depth
*   on a bracket they never emit.
* - Argument annotation, `async def f(self, args: chain) -> Y:` — the `(` IS
*   still open around it: 180 `list[` plus `Literal[` plus the paren, 182, the
*   worst case. Reachable only through a raw `register()` whose `parameters`
*   is an array reached from the root through `oneOf` arms alone — the root
*   array itself, or one nested under any depth of unions, since an arm
*   inherits the enclosing depth unchanged (`A | B` opens no bracket). An
*   object ancestor takes it out of this case: its fields restart the chain at
*   the 181 site. `defineTool` compiles an object root, so the annotation is a
*   bare TypedDict class name or a one-bracket `dict[str, Any]` when that
*   object degrades — never a chain.
*
* A CPython grammar limit, not a deployment choice, so it is fixed rather than
* configurable. The sibling `ts-types` renderer needs no counterpart: nothing
* in the TypeScript grammar bounds nesting, and its SDK block is never type-
* checked. Only bracket nesting counts — a `oneOf` renders as a flat `A | B`
* chain and nested objects render as separate `class` statements, so neither
* accumulates open brackets at any depth. The invariant this cap serves is
* grammatical validity; see the `oneOf` arm in {@link renderType} for the one
* interpreter limit deliberately left uncapped.
*/
const MAX_LIST_NESTING = 180;
/**
* Cap a class-name base at {@link MAX_CLASS_NAME_BASE} (see the callers for
* why capping keeps the render linear). `slice` counts UTF-16 code units, so
* an astral character straddling the boundary would be cut in half and leave a
* lone surrogate — not an identifier character, and not even well-formed text;
* drop it rather than emit it.
*/
function capClassNameBase(base) {
	if (base.length <= MAX_CLASS_NAME_BASE) return base;
	const capped = base.slice(0, MAX_CLASS_NAME_BASE);
	return /[\uD800-\uDBFF]$/.test(capped) ? capped.slice(0, -1) : capped;
}
/**
* Reserve a unique class name from a base, suffixing `2`, `3`, … on collision.
* The base is capped at {@link MAX_CLASS_NAME_BASE} first: child class names
* derive from their parent's allocated name (`ParentChild`), so an unbounded
* schema of single-field objects would otherwise grow each name by one field
* per level and the sum of all names to Θ(depth²). Capping the base keeps each
* name — and the total emitted text — linear in depth. Collisions resume from
* the per-base counter in `state.nextClassCounter` rather than rescanning from
* `2`, so a deep chain sharing one capped base stays O(1) per allocation
* (amortized) instead of Θ(depth²) in time.
*/
function allocateClassName(base, state) {
	const capped = capClassNameBase(base);
	let name = capped;
	if (state.usedClassNames.has(name)) {
		let n = state.nextClassCounter.get(capped) ?? 2;
		while (state.usedClassNames.has(`${capped}${n}`)) n++;
		name = `${capped}${n}`;
		state.nextClassCounter.set(capped, n + 1);
	}
	state.usedClassNames.add(name);
	return name;
}
/**
* Append a child-name segment to a parent class-name base, capping the result
* at {@link MAX_CLASS_NAME_BASE}. Capping AT PROPAGATION (not only inside
* {@link allocateClassName}) keeps each level O(1): a deep `oneOf`- or
* object-chain would otherwise carry an ever-growing ConsString down the tree
* and re-materialize it (via `.length`/`.slice`) at every level — Θ(depth²).
* The bounded base plus the collision counter still yields unique names.
*
* The join is NFKC-normalized because both sides are separately normalized yet
* their concatenation need not be: a base ending in a Hangul L jamo or LV
* syllable composes with a following V or T jamo head (`가` + `ᆨ` gives `각`),
* so the emitted class name would differ from the symbol CPython compiles, and
* two byte-distinct names could fold onto one — `usedClassNames` dedupes by the
* raw bytes, so the collision counter would not see it. Normalizing costs
* O(cap + segment) per level, the same order as the `slice` it feeds. The other
* two join points need no counterpart: `Args`/`Output` start with `A`/`O` and
* {@link allocateClassName}'s suffix is digits, none of which compose backwards.
*/
function childClassName(base, segment) {
	return capClassNameBase(`${base}${segment}`.normalize("NFKC"));
}
/**
* Render one validated scalar as Python literal text (`True`/`False`,
* JSON-quoted strings, bare numbers). `null` cannot reach here: the `null`
* type renders directly as `None`, and the unified validator rejects a null
* `const`/`enum` entry on every other scalar type.
*
* A beyond-safe-range integral number takes `BigInt` digits rather than
* `String`: Python integers are arbitrary-precision, so the emitted digits ARE
* the value the model programs against, and `String` can give a different
* integer than the double holds (`2 ** 60` prints the rounded `...847000`, not
* the exact `...846976`) or no integer literal at all (`1e21` prints `1e+21`).
* `String`'s rounding is not a bug in it: `Number::toString` emits the shortest
* decimal string that re-reads to the same double, then pads to the exponent
* with zeros (1 significant digit for `1e20`, 16 for `2 ** 60`) — and when the
* shortest string is shorter than the double's exact value, those padded digits
* name an integer no double holds. Passing one back would have to cross the
* argument boundary as a JSON number — a double again — so the SDK would
* document a value no program can pass. `BigInt` needs no case split: where
* `String` is already exact (`2 ** 53`, `1e20`) the two agree byte for byte,
* and where it is not, `BigInt` is the exact one. The TS flavor needs no
* counterpart at all: its literal is re-read by a JS parser back into the same
* double.
*
* `JSON.stringify` is also what keeps this path's output parseable, and it is
* the only thing that does. It covers both classes of hazard: the two kinds of
* code point CPython refuses anywhere in source — NUL among the C0 controls,
* and the whole D800–DFFF unpaired-surrogate block, escaped under ES2019
* well-formed stringification, which the engines range guarantees — and the
* ones that break this line in particular, a bare `"` closing the literal
* early, a trailing odd backslash eating the closing quote, and a bare LF/CR
* ending it before its terminator. The `description` path carries
* {@link UNPRINTABLE} and {@link LONE_SURROGATE} because nothing quotes it,
* and folds newlines in {@link describe}.
*
* That leans on a coincidence worth naming: every escape `JSON.stringify` can
* emit (`\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`, `\uXXXX`) is also a Python
* escape denoting the same character, so the emitted `Literal[...]` both
* parses and decodes back to the value the schema declared. DEL, the C1
* controls (NEL among them), and LS/PS (U+2028/U+2029) do reach it raw —
* legal but invisible, byte-for-byte as in the TS flavor; escaping them is a
* both-flavors change. Those last three are legal here for the reason
* {@link UNPRINTABLE} records: they are `str.splitlines()` boundaries, not
* tokenizer line terminators. The subscript tool-name comment quotes its name
* through its own call to the same `JSON.stringify`, never through this
* function, and inherits both halves — escapes and pass-throughs alike.
*/
function pyScalar(value) {
	if (value === true) return "True";
	if (value === false) return "False";
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value)) return BigInt(value).toString();
	return String(value);
}
/**
* Render a validated scalar `const`/`enum` as `Literal[...]`, falling back to
* the broad type. Deliberately deviates from PEP 586, which restricts `Literal`
* parameters to int/bool/str/bytes/enum/None: a non-integral number
* `const`/`enum` emits a float literal (`Literal[1.5]`) a strict checker would
* reject. An integral one does not deviate — {@link pyScalar} emits int digits,
* including for the beyond-safe-range values it widens through `BigInt`, and
* PEP 586 admits int parameters. Harmless either way — the stub is advisory
* prompt text, only required to parse — and keeping the exact value
* communicates the constraint to the model.
*/
function renderConstrainedScalar(node, broad, state) {
	if (node.const !== void 0) {
		state.typing.add("Literal");
		return `Literal[${pyScalar(node.const)}]`;
	}
	if (node.enum !== void 0) {
		state.typing.add("Literal");
		return `Literal[${node.enum.map(pyScalar).join(", ")}]`;
	}
	return broad;
}
/**
* Map one JSON-Schema node to a Python type expression, threading `state` to
* collect the `TypedDict` declarations and `typing` symbols a full render
* needs. `className` is the name to give an object node with properties (and
* the prefix for its nested objects). Handles every unified schema construct —
* `oneOf` (→ `X | Y`), `const`/`enum` (→ `Literal[...]`), `integer` (→ `int`),
* `null` (→ `None`) — and degrades an unsupported or malformed schema to `Any`
* without throwing, the same trusted-after-validation stance as the sibling
* {@link ./ts-types.ts | ts-types} renderer. {@link jsonSchemaToPy} is the
* context-free entry point; this is the collecting core.
*/
function renderType(schema, className, state) {
	const newFrame = (schema, className, listDepth) => ({
		schema,
		className,
		phase: "start",
		listDepth,
		children: [],
		childIndex: 0,
		childTypes: [],
		entries: []
	});
	try {
		assertSupportedJsonSchema(schema);
		const frames = [newFrame(schema, className, 0)];
		let result;
		const finish = (type) => {
			frames.pop();
			const parent = frames.at(-1);
			if (parent === void 0) result = type;
			else parent.childTypes.push(type);
		};
		while (frames.length > 0) {
			const frame = frames.at(-1);
			/* v8 ignore next -- the loop condition guarantees a current frame. */
			if (frame === void 0) break;
			if (frame.phase === "children") {
				if (frame.childIndex < frame.children.length) {
					const child = frame.children[frame.childIndex];
					/* v8 ignore next -- childIndex is bounded by children.length. */
					if (child === void 0) throw new Error("missing python render child");
					frame.childIndex++;
					frames.push(newFrame(child.schema, child.className, child.listDepth));
					continue;
				}
				if (frame.kind === "oneOf") {
					let union = "";
					for (const [index, childType] of frame.childTypes.entries()) union = index === 0 ? childType : `${union} | ${childType}`;
					finish(union);
					continue;
				}
				if (frame.kind === "array") {
					/* v8 ignore next -- the ?? arm needs a childless array frame, which start never builds. */
					finish(`list[${frame.childTypes[0] ?? "Any"}]`);
					continue;
				}
				const node = frame.node;
				const name = frame.allocated;
				/* v8 ignore next -- typeddict frames always set node and allocated at start. */
				if (node === void 0 || name === void 0) throw new Error("missing typeddict frame state");
				const required = new Set(node.required);
				const lines = [`class ${name}(TypedDict):`];
				for (let index = 0; index < frame.entries.length; index++) {
					const entry = frame.entries[index];
					const fieldType = frame.childTypes[index];
					/* v8 ignore next -- entries and childTypes correspond one-to-one. */
					if (entry === void 0 || fieldType === void 0) throw new Error("missing typeddict field type");
					const [field, fieldSchema] = entry;
					const description = describe(fieldSchema);
					if (description !== void 0) lines.push(`${pad(1)}# ${description}`);
					if (required.has(field)) lines.push(`${pad(1)}${field}: ${fieldType}`);
					else {
						state.typing.add("NotRequired");
						lines.push(`${pad(1)}${field}: NotRequired[${fieldType}]`);
					}
				}
				if (node.additionalProperties !== false) lines.push(`${pad(1)}# Additional keys beyond those declared are allowed.`);
				if (lines.length === 1) lines.push(`${pad(1)}pass`);
				state.classes.push(lines.join("\n"));
				finish(name);
				continue;
			}
			frame.phase = "children";
			const node = frame.schema;
			if (node.oneOf !== void 0) {
				frame.kind = "oneOf";
				frame.children = node.oneOf.map((branch, index) => ({
					schema: branch,
					className: childClassName(frame.className, `${index + 1}`),
					listDepth: frame.listDepth
				}));
				continue;
			}
			if (node.type === void 0) {
				state.typing.add("Any");
				finish("Any");
				continue;
			}
			switch (node.type) {
				case "string":
					finish(renderConstrainedScalar(node, "str", state));
					break;
				case "number":
					finish(renderConstrainedScalar(node, "float", state));
					break;
				case "integer":
					finish(renderConstrainedScalar(node, "int", state));
					break;
				case "boolean":
					finish(renderConstrainedScalar(node, "bool", state));
					break;
				case "null":
					finish("None");
					break;
				case "array":
					if (node.items === void 0) {
						state.typing.add("Any");
						finish("list[Any]");
						break;
					}
					if (frame.listDepth >= MAX_LIST_NESTING) {
						state.typing.add("Any");
						finish("Any");
						break;
					}
					frame.kind = "array";
					frame.children = [{
						schema: node.items,
						className: frame.className,
						listDepth: frame.listDepth + 1
					}];
					break;
				case "object": {
					const entries = Object.entries(node.properties ?? {});
					if (className === "" || !entries.every(([name]) => isBareIdentifier(name) && !RESERVED.has(name) && !(name.startsWith("__") && !name.endsWith("__")))) {
						state.typing.add("Any");
						finish("dict[str, Any]");
						break;
					}
					if (entries.length === 0 && node.additionalProperties !== false) {
						state.typing.add("Any");
						finish("dict[str, Any]");
						break;
					}
					frame.kind = "typeddict";
					frame.node = node;
					frame.allocated = allocateClassName(frame.className, state);
					state.typing.add("TypedDict");
					frame.entries = entries;
					/* v8 ignore next -- allocated is always set before children are built. */
					frame.children = entries.map(([field, child]) => ({
						schema: child,
						className: childClassName(frame.allocated ?? "", camelCase(field)),
						listDepth: 1
					}));
					break;
				}
				/* v8 ignore next 4 -- assertSupportedJsonSchema narrowed this closed type union. */
				default:
					state.typing.add("Any");
					finish("Any");
			}
		}
		/* v8 ignore next -- every root frame produces one expression. */
		return result ?? "Any";
	} catch {
		state.typing.add("Any");
		return "Any";
	}
}
/** The fixed model-facing usage contract rendered above the declarations. */
const SDK_INSTRUCTIONS = `## Writing code for run_code

\`run_code\` takes two required arguments: \`code\` — the body of an async Python function (top-level \`await\` and \`return\` both work) — and \`description\`, a short summary of what the program does. At run time exactly two of the names declared below are bound: \`tools\` and \`ToolCallError\`. Everything else is a STATIC STUB describing argument and return types — in particular the \`TypedDict\` classes do NOT exist at run time, so build arguments as plain \`dict\`/\`list\` JSON values: \`await tools.name({"field": 1})\`, never \`FooArgs(field=1)\`, which raises \`NameError\`. Inside the program:

- Call tools as \`await tools.name(args)\` — subscript access for exotic, reserved, or underscore-leading names: \`await tools["my-tool"](args)\`. Every call resolves to the tool's typed canonical JSON value (each method's return type below). Tool arguments must be lossless JSON.
- A FAILED tool call raises \`ToolCallError\`, whose \`toolName\` identifies the failed tool and whose message is human-readable — wrap in \`try/except\` to handle and continue.
- Independent read-only calls MAY overlap under \`asyncio.gather\` (safe calls run concurrently; mutating calls run alone, in submission order). Sequence dependent work with \`await\`.
- Emit the run's answer with \`print(...)\` and/or a top-level \`return <value>\`; the returned value must be lossless JSON. Only what you print and return is program output. A successful tool result containing an image is attached after the run so you can inspect it on the next step; every other intermediate result stays out of the conversation, so extract just what you need.

The available tools:`;
/**
* Render the full `tools:sdk` prompt section under `runtime.language ===
* 'python'`: the Python-flavored usage instructions plus one named `TypedDict`
* per tool argument or output object (and per nested object) and one awaitable
* method per visible tool on a `Tools` protocol — typed args in, the tool's
* canonical output value out — with a `tools: Tools` singleton the model calls
* into. The `typing` import line lists exactly the symbols the render used.
* Deterministic — tools are emitted in lexicographic name order, and class
* declarations precede the protocol in that same order (nested classes before
* the parent that references them), so an unchanged tool set produces
* byte-identical text across assemblies. The sort is not a total order on
* byte-equal names, so two schemas sharing a name would render in argument
* order; the caller's visible-capability map is keyed by name, so the input
* never carries a duplicate.
* @param schemas - the tool schemas plus canonical output schemas to declare
*   (the caller excludes `run_code` itself).
* @returns the complete section text.
*/
function renderToolsSdkPy(schemas) {
	const sorted = [...schemas].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
	const state = {
		classes: [],
		usedClassNames: /* @__PURE__ */ new Set(),
		nextClassCounter: /* @__PURE__ */ new Map(),
		typing: /* @__PURE__ */ new Set(["Protocol"])
	};
	const members = [];
	let statements = 0;
	for (const schema of sorted) {
		const argType = renderType(schema.parameters, `${camelCase(schema.name)}Args`, state);
		const outputType = renderType(schema.output, `${camelCase(schema.name)}Output`, state);
		if (isBareIdentifier(schema.name) && !RESERVED.has(schema.name) && !schema.name.startsWith("_")) {
			const doc = docLines(schema.description, 2);
			members.push(doc.length > 0 ? `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}:` : `${pad(1)}async def ${schema.name}(self, args: ${argType}) -> ${outputType}: ...`);
			members.push(...doc);
			statements += 1;
		} else {
			members.push(`${pad(1)}# tools[${JSON.stringify(schema.name)}](args: ${argType}) -> ${outputType}`);
			const description = describe(schema);
			if (description !== void 0) members.push(`${pad(1)}#   ${description}`);
		}
	}
	const body = (statements > 0 ? members : [`${pad(1)}pass`, ...members]).join("\n");
	const imports = TYPING_ORDER.filter((symbol) => state.typing.has(symbol));
	const classBlock = state.classes.length > 0 ? `${state.classes.join("\n\n")}\n\n` : "";
	return `${SDK_INSTRUCTIONS}\n\n\`\`\`python\n${`from typing import ${imports.join(", ")}\n\nclass ToolCallError(Exception):
    toolName: str\n\n${classBlock}class Tools(Protocol):\n${body}\n\ntools: Tools`}\n\`\`\``;
}
/**
* Tool registry, model presentation modes, and pre/guard/around/post/result
* execution pipeline.
* @module @deepseek-ai/dsh-tools
*/
/**
* Language → SDK-section renderer. The registry looks up the loaded
* `ctx.codeRuntime.language` in this table when assembling the `tools:sdk`
* section under a non-native mode; a runtime whose language is not a key
* fails the assembly loudly (same idiom as `toolOrder` violations). Adding a
* new backend language is three parallel edits — a {@link CodeSdkLanguage}
* member, an entry here, and a `RUN_CODE_FLAVORS` entry in `ptc.ts` for
* its `run_code` schema strings — plus the renderer function this table points
* at. The `satisfies` clause pins this table's key set to that union, which
* the flavor table is checked against too, so any of the three left out is a
* typecheck failure. What no check reaches is the prose that names the values
* instead of deriving them: the seam's `dsh-code-runtime` README pair, its
* `CodeRuntime.language` JSDoc, and `docs/subsystems/code-runtime.md`
* with its zh pair, plus this package's own README pair and the
* {@link Config.mode} JSDoc.
*/
/**
* Prompt order of the `ptc` collapse statement: after the persona and before
* per-tool guidance, so the model reads which tools it may call before it
* reads what each one is for.
*/
const COLLAPSE_SECTION_ORDER = FIRST_PARTY_SECTION_ORDER.PTC_ONLY;
/**
* The model-facing statement of the `ptc` collapse. Names the consequence
* (the call fails) and the route (inside the program), because a rule the
* model can only discover by being denied is one it corrects too late.
*/
const PTC_ONLY_INSTRUCTION = `\`${RUN_CODE_NAME}\` is the only tool you can call directly — a tool call naming any other tool fails. Reach every tool the SDK declares below from inside the program.`;
const SDK_RENDERERS = {
	typescript: renderToolsSdk,
	python: renderToolsSdkPy
};
/**
* Scheduler entry point omitted from the generated named service API.
* @internal
*/
const TOOL_RUNTIME_SCHEDULER = Symbol("@deepseek-ai/dsh-tools.scheduler");
/** Canonical error code for cancellation after a tool body was invoked. */
const TOOL_ABORTED = "ABORTED";
/** Canonical error code for cancellation before a tool body was invoked. */
const TOOL_ABORTED_BEFORE_DISPATCH = "ABORTED_BEFORE_DISPATCH";
/**
* Thrown (internally) when the model requests a tool that isn't registered.
* Extends {@link HarnessError} (`code: 'UNKNOWN_TOOL'`) so an unknown-tool
* failure is as routable as a tool-thrown one — retry/sandbox/replay code can
* distinguish it from a tool body's own error.
*/
var ToolNotFoundError = class extends HarnessError {
	/**
	* @param toolName - the name the caller asked for.
	* @param reachableFrom - how the model reaches this tool instead, when the
	*   name IS visible and only the presentation denies calling it directly.
	*   Omitted for a name that is registered nowhere.
	*/
	constructor(toolName, reachableFrom) {
		let message;
		if (typeof toolName !== "string" || toolName.trim().length === 0) message = "unknown tool: the model emitted a tool call with an empty name ——【工具调用 name 为空】可能原因：① 适配器协议不匹配（在「设置 → 模型」确认该供应商实际使用 Chat Completions / Responses / Anthropic Messages 协议，与所选 api 一致）；② 中转网关（如 tokenrhythm）剥离或损坏了 tool_call/name 字段；③ 长上下文下模型输出 JSON 崩坏。请先核对协议、绕过中转网关直连重试。";
		else if (reachableFrom === void 0) message = `unknown tool "${toolName}"`;
		else message = `unknown tool "${toolName}": ${reachableFrom}`;
		super(message, "UNKNOWN_TOOL");
		this.name = "ToolNotFoundError";
	}
};
/** Thrown when a tool body or post-policy value violates its declared output. */
var ToolOutputError = class extends HarnessError {
	/** Schema/value violations in validation order. */
	violations;
	constructor(toolName, violations) {
		super(`tool "${toolName}" returned invalid output: ${violations.join("; ")}`, "INVALID_TOOL_OUTPUT");
		this.name = "ToolOutputError";
		this.violations = violations;
	}
};
/** Convert one projector exception into the canonical invalid-output failure. */
function projectionError(toolName, projector, error) {
	return new ToolOutputError(toolName, [`output.${projector} failed: ${errorMessage(error)}`]);
}
/** Snapshot one projector result before later durable-result materialization. */
function snapshotProjection(toolName, projector, candidate) {
	try {
		const detached = snapshotJsonValue(candidate);
		if (detached === void 0) throw new ToolOutputError(toolName, [`output.${projector} returned non-lossless JSON`]);
		return detached;
	} catch (error) {
		if (error instanceof ToolOutputError) throw error;
		throw projectionError(toolName, projector, error);
	}
}
/** Snapshot one body or policy value into the canonical invalid-output failure class. */
function snapshotToolValue(toolName, candidate) {
	try {
		const detached = snapshotJsonValue(candidate);
		if (detached === void 0) throw new ToolOutputError(toolName, ["value is not lossless JSON"]);
		return detached;
	} catch (error) {
		if (error instanceof ToolOutputError) throw error;
		throw new ToolOutputError(toolName, [`value snapshot failed: ${errorMessage(error)}`]);
	}
}
/**
* Best-effort human-readable message from an arbitrary thrown value: Error
* instances use `.message`; non-Error objects with a string `message`
* property (e.g. `throw { message: 'denied' }`) use it too; everything else
* is stringified.
*/
function errorMessage(error) {
	try {
		if (error instanceof Error) return error.message;
		if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
		return String(error);
	} catch {
		return "<unprintable thrown value>";
	}
}
/** Derive one failure message from policy feedback without changing its rendered blocks. */
function failureMessageFromContent(content) {
	const text = content.map((block) => block.type === "text" ? block.text : `[${block.type} content]`).join("\n");
	return text.length > 0 ? text : "tool result blocked by post-execute policy";
}
/** Snapshot and freeze one durable tool-result projection or reject lossy data. */
function materializePresentation(candidate) {
	const detached = snapshotJsonValue(candidate);
	if (detached === void 0) throw new TypeError("tool result must be losslessly JSON-serializable");
	return deepFreeze$1(detached);
}
/** Structured `{ name, code }` for a thrown HarnessError, else undefined. */
function errorInfo(error) {
	try {
		return error instanceof HarnessError ? {
			name: error.name,
			code: error.code
		} : void 0;
	} catch {
		return;
	}
}
/** One scope's complete tool-registry contribution. */
var ToolLayer = class {
	tools;
	restrictions = new AnonymousEntries();
	guards = new AnonymousEntries();
	/**
	* Presentation this scope's agent declared for itself, shadowing the
	* deployment default. One cell rather than an entry table: two answers to
	* "which form does the model see" is a contradiction, not a merge.
	*/
	mode;
	constructor(scope) {
		this.tools = new NamedEntries((name) => /* @__PURE__ */ new Error(scope === void 0 ? `tool "${name}" is already registered (for a per-agent variant, register through that agent's \`agent.ctx\` instead)` : `tool "${name}" is already registered in this scope`));
	}
	/** Whether every contribution table in this aggregate layer is empty. */
	isEmpty() {
		return this.tools.isEmpty() && this.restrictions.isEmpty() && this.guards.isEmpty() && this.mode === void 0;
	}
	/** Whether every compiled restriction in this layer admits a global tool name. */
	admits(name) {
		for (const filter of this.restrictions.values()) if (filter.allow !== void 0 && !filter.allow.has(name) || filter.deny !== void 0 && filter.deny.has(name)) return false;
		return true;
	}
	/** First monotonic denial from this layer's live guard registrations. */
	guardReason(exec) {
		for (const guard of this.guards.values()) {
			const reason = guard(exec);
			if (reason !== void 0) return reason;
		}
	}
};
/** Resolve the run_code overlap cap at the owning config boundary (direct construction bypasses the Loader schema). */
function resolveMaxParallelSubCalls(value) {
	const maxParallelSubCalls = value ?? 10;
	if (!Number.isInteger(maxParallelSubCalls) || maxParallelSubCalls < 1) throw new Error("maxParallelSubCalls must be a positive integer");
	return maxParallelSubCalls;
}
(class extends Service {
	static inject = ["systemPrompt"];
	static Config = Schema.object({
		mode: Schema.union([
			"native",
			"ptc",
			"both"
		]).default("native"),
		maxParallelSubCalls: Schema.natural().min(1).default(10)
	});
	/** Internal staged view consumed by `dsh-agent-loop`'s parallel scheduler. */
	[TOOL_RUNTIME_SCHEDULER] = {
		prepare: (exec) => this.prepareScheduledExecution(exec),
		dispatch: (exec) => this.dispatchScheduledExecution(exec),
		finalize: (exec, result) => this.finalizeScheduledExecution(exec, result),
		finish: (exec, result) => this.finishScheduledExecution(exec, result)
	};
	/**
	* dsh-desktop compat: global-symbol scheduler mirror.
	* Symbol() keys are copy-unique: when a second dsh-tools instance ends up
	* in-process (a plugin bundling its own nested copy), dsh-agent-loop's
	* module-local symbol misses that instance's scheduler field and tool
	* turns died with "Cannot read properties of undefined (reading
	* 'prepare')". Symbol.for is process-global, so the agent-loop guard
	* resolves the scheduler across copies. Kernel-internal callers keep
	* using the private symbol.
	*/
	[Symbol.for("@deepseek-ai/dsh-tools.scheduler")] = this[TOOL_RUNTIME_SCHEDULER];
	/** Context deferred by a running tool body, keyed by its scheduler-owned execution. */
	deferredContexts = /* @__PURE__ */ new WeakMap();
	/** Executions whose tool body declared the current turn complete. */
	concludingExecutions = /* @__PURE__ */ new WeakSet();
	/** Original caller cancellation, kept outside the wrapper-mutable execution object. */
	cancellationStates = /* @__PURE__ */ new WeakMap();
	/** Definition-owned final content transform snapshotted before policy begins. */
	contentFinalizers = /* @__PURE__ */ new WeakMap();
	layers = new ScopedLayers((scope) => new ToolLayer(scope), () => {
		this.ctx.emit("tools/change");
	});
	/** Presentation for scopes that declare none; {@link presentAs} shadows it per scope. */
	defaultMode;
	maxParallelSubCalls;
	/**
	* Reserved presentation transport, kept outside the filterable registration
	* layers. Built on first need rather than at construction: which agents run
	* a PTC mode is no longer known when the service is constructed, and the
	* transport is stateless beyond its closures over `this`.
	*/
	ptcTransport;
	constructor(ctx, config = {}) {
		super(ctx, "tools");
		this.defaultMode = config.mode ?? "native";
		this.maxParallelSubCalls = resolveMaxParallelSubCalls(config.maxParallelSubCalls);
		ctx.systemPrompt.tools((context) => this.wireSchemas(context.scope));
		if (this.defaultMode !== "native") {
			ctx.systemPrompt.section(this.collapseSection());
			ctx.systemPrompt.section(this.sdkSection());
		}
	}
	/**
	* The prompt statement of the `ptc` executor collapse, registered wherever
	* {@link sdkSection} is and rendering empty outside an effective `ptc`.
	*
	* Every tool contributes its own guidance section naming its tool, none of
	* them qualify how that tool is reached, and they all render before the SDK.
	* Without this the model reads a catalog of tools it is told to use and no
	* statement that only `run_code` may be called, so it emits a native call,
	* receives `UNKNOWN_TOOL` for a tool the prompt just declared, and concludes
	* the deployment is inconsistent. {@link COLLAPSE_SECTION_ORDER} places the rule
	* before that guidance rather than after it.
	*
	* `both` renders empty: native calls do execute there, so the rule is false.
	* @returns the section registration.
	*/
	collapseSection() {
		return {
			name: "tools:ptc-only",
			order: COLLAPSE_SECTION_ORDER,
			text: (context) => this.modeFor(context.scope) === "ptc" ? PTC_ONLY_INSTRUCTION : ""
		};
	}
	/**
	* The generated-SDK prompt section, registered globally by a PTC mode
	* deployment and per scope by {@link presentAs}.
	*
	* The body regenerates from the CALLING scope, and renders empty for an
	* agent presenting natively — an agent that opted out under a PTC mode
	* deployment still sees the global registration, and an empty section is
	* dropped from the rendered prompt.
	* @returns the section registration.
	*/
	sdkSection() {
		return {
			name: "tools:sdk",
			order: SDK_SECTION_ORDER,
			text: (context) => {
				const mode = this.modeFor(context.scope);
				if (mode === "native") return "";
				const runtime = this.requireCodeRuntime(mode);
				const render = SDK_RENDERERS[runtime.language];
				/* v8 ignore next -- requireCodeRuntime rejects an unknown language before this runs. */
				if (render === void 0) throw new Error(`dsh-tools: no SDK renderer for ${runtime.language}`);
				return render(this.sdkSchemas(context.scope));
			}
		};
	}
	/**
	* The presentation one scope's agent sees: its own declaration, else the
	* deployment default.
	* @param scope - the calling agent, or undefined for the global view.
	* @returns the resolved presentation mode.
	*/
	modeFor(scope) {
		const layers = this.layers.chainLayers(scope);
		for (let index = layers.length - 1; index >= 0; index -= 1) {
			const mode = layers[index]?.mode;
			if (mode !== void 0) return mode;
		}
		return this.defaultMode;
	}
	/**
	* The reserved `run_code` transport, built on first need.
	*
	* It never enters the global layer: per-agent restrictions must not remove
	* it, and a scoped registration must not shadow it. The visibility resolver
	* appends it after resolving the filterable global/scoped capability layers,
	* and only for scopes whose mode actually presents it.
	* @returns the shared transport definition.
	*/
	requireCodeTransport() {
		this.ptcTransport ??= createRunCodeTool(this, {
			requireRuntime: () => this.requireCodeRuntime(this.defaultMode),
			peekRuntime: () => this.ctx.get("codeRuntime"),
			maxParallel: this.maxParallelSubCalls,
			shapeDispatchLog: (dispatch) => this.shapeDispatchLog(dispatch)
		});
		return this.ptcTransport;
	}
	/**
	* Present the calling scope's tools in `mode` instead of the deployment
	* default. Nearest scope on the chain wins, so a preset's standing
	* declaration covers every agent joined under it.
	*
	* Scoped only, and one declaration per scope: this is how an agent preset
	* composes PTC mode agents beside native ones in the same process, and a
	* process-global override would be the `mode` config field instead.
	* @param mode - the presentation the covered agents' models see.
	* @returns the exact disposer that restores the deployment default.
	*/
	presentAs(mode) {
		const ctx = this.ctx;
		if (scopeOf(ctx) === void 0) throw new Error("tools.presentAs() requires a scoped context (agent.ctx): a context-global presentation is the `mode` config field on the tools row");
		return ctx.effect(function* () {
			yield this.layers.effect(ctx, (layer) => {
				if (layer.mode !== void 0) throw new Error(`tools.presentAs("${mode}") conflicts with "${layer.mode}" already declared for this scope; one composition selects one presentation`);
				layer.mode = mode;
				return () => {
					layer.mode = void 0;
				};
			}, { label: "tools.presentAs()" });
			if (mode !== "native") {
				yield ctx.systemPrompt.section(this.collapseSection());
				yield ctx.systemPrompt.section(this.sdkSection());
			}
		}.bind(this), "tools.presentAs()");
	}
	/**
	* Build one scope's wire schemas and names for prompt-order validation.
	* Restrictions do not make known tools invalid, but a mode collapse does.
	*/
	wireSchemas(scope) {
		const view = this.view(scope);
		const mode = this.modeFor(scope);
		if (mode === "native") return {
			schemas: [...view.visible.values()].map((definition) => this.schemaOf(definition, false)),
			knownNames: [...view.knownNames]
		};
		this.requireCodeRuntime(mode);
		const schemas = [...view.visible.values()].map((definition) => this.schemaOf(definition, false));
		if (mode === "ptc") return {
			schemas: schemas.filter((schema) => schema.name === RUN_CODE_NAME),
			knownNames: [RUN_CODE_NAME]
		};
		return {
			schemas,
			knownNames: [...view.knownNames, RUN_CODE_NAME]
		};
	}
	/**
	* Resolve the code runtime or throw the actionable misconfiguration error.
	* Read at use time (assembly / run_code execution), NOT via static
	* `inject`: an inject entry would hold `ctx.tools` — and every tool plugin
	* behind it — hostage to a code runtime existing even under `mode:
	* 'native'`.
	*
	* Assembly and `run_code` execution read separately, so the language is not
	* bound to a request. Harmless while one published backend exists — both
	* reads return the same flavor — but a reload that swapped in a second
	* language between them would hand a program written against one SDK to the
	* other. Binding it is deferred until a second backend ships (the first
	* point it is testable); rationale in the
	* [language-dispatch note](../../../../.agents/notes/implemented/feature/2026-07-31-ptc-language-dispatch.md).
	*/
	requireCodeRuntime(mode) {
		const runtime = this.ctx.get("codeRuntime");
		if (!runtime) throw new Error(`dsh-tools: mode "${mode}" requires a code runtime — load a ctx.codeRuntime implementation (e.g. @deepseek-ai/dsh-code-runtime-worker-thread) or set tools mode to "native"`);
		if (!Object.hasOwn(SDK_RENDERERS, runtime.language)) {
			const known = Object.keys(SDK_RENDERERS).map((name) => JSON.stringify(name)).join(", ");
			throw new Error(`dsh-tools: no SDK renderer registered for runtime language ${JSON.stringify(runtime.language)} (known: ${known})`);
		}
		return runtime;
	}
	/**
	* Register globally or in the calling agent scope. Scoped tools shadow
	* globals; duplicates within one layer and the reserved `run_code` name fail.
	* @param definition - tool schema, execution, and optional finalization/presentation callbacks.
	* @returns the exact disposer that unregisters the tool.
	*/
	register(definition) {
		const name = definition.name;
		const output = definition.output;
		if (output === void 0 || typeof output !== "object" || typeof output.render !== "function" || output.presentationMeta !== void 0 && typeof output.presentationMeta !== "function") throw new TypeError(`tool "${name}" must declare output { schema, render, presentationMeta? }`);
		assertSupportedJsonSchema(output.schema);
		const timeoutMs = definition.timeoutMs;
		if (timeoutMs !== void 0 && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) throw new TypeError(`tool "${name}" timeoutMs must be a positive finite number`);
		if (name === "run_code") throw new Error(`tool name "${RUN_CODE_NAME}" is reserved for the PTC mode presentation transport and cannot be registered or shadowed`);
		return this.layers.effect(this.ctx, (layer) => layer.tools.insert(name, definition), { label: "tools.register()" });
	}
	/**
	* Restrict global tools for the calling agent scope. Empty filters, unknown
	* names, scope-local names, and reserved transport names fail. Restrictions
	* intersect; scoped registrations remain visible.
	* @param filter - global-tool mask: `allow` (keep only) and/or `deny` (remove).
	* @returns the exact disposer that lifts this restriction.
	*/
	restrict(filter) {
		const scope = scopeOf(this.ctx);
		if (scope === void 0) throw new Error("tools.restrict() requires a scoped context (agent.ctx): a context-global restriction would mask every agent — deny the tool for the intended agent instead");
		const allow = filter.allow;
		const deny = filter.deny;
		if (allow === void 0 && deny === void 0) throw new Error("tools.restrict({}) is a no-op: pass `allow` and/or `deny` (an empty filter is almost always a materialized-empty-config bug)");
		const compiled = {
			...allow !== void 0 ? { allow: new Set(allow) } : {},
			...deny !== void 0 ? { deny: new Set(deny) } : {}
		};
		if ([...allow ?? [], ...deny ?? []].includes("run_code")) throw new Error(`tools.restrict() cannot name reserved PTC mode presentation transport "${RUN_CODE_NAME}"; restrict end-capability tools instead`);
		const known = this.view(scope).restrictableNames;
		const unknown = [...allow ?? [], ...deny ?? []].filter((name) => !known.has(name));
		if (unknown.length > 0) throw new Error(`tools.restrict() names unknown global tool${unknown.length > 1 ? "s" : ""} ${unknown.map((n) => `"${n}"`).join(", ")}; known global tools: ${[...known].sort().join(", ") || "(none)"}`);
		return this.layers.effect(this.ctx, (layer) => layer.restrictions.append(compiled), { label: "tools.restrict()" });
	}
	/**
	* Register a monotonic guard after the extensible `tools/pre-execute`
	* waterfall. A plain-context guard applies globally; one registered through
	* `agent.ctx` applies only to that agent. Any matching guard may deny by
	* returning a reason, while no guard can force-allow a call another guard
	* denied. The exact effect disposer is returned for ordered ownership and
	* HMR cleanup.
	* @param guard - synchronous check; a returned string denies the execution.
	* @returns the exact disposer that unregisters the guard.
	*/
	guard(guard) {
		return this.layers.effect(this.ctx, (layer) => layer.guards.append(guard), {
			label: "tools.guard()",
			notify: false
		});
	}
	/** First monotonic denial from the global then the scope chain's guard layers, farthest first. */
	guardReason(exec) {
		const globalReason = this.layers.global.guardReason(exec);
		if (globalReason !== void 0) return globalReason;
		if (exec.agent === void 0) return void 0;
		for (const layer of this.layers.chainLayers(exec.agent)) {
			const reason = layer.guardReason(exec);
			if (reason !== void 0) return reason;
		}
	}
	/**
	* Resolve every registry fact one scope needs in one layer traversal. The
	* visible map applies restrictions to the INHERITED surface, then the
	* scope's own registrations and the reserved presentation transport; the
	* other sets retain the pre-restriction facts needed by restriction and
	* prompt-order validation.
	*
	* A restriction filters what a scope inherits — the global layer and every
	* ancestor layer on its chain — and never what its OWN layer registers.
	* That exemption is what a per-child capability filter has to keep intact:
	* the delegation runtime registers a child's reporting and structured-output
	* tools into the child's own layer, and a filter naming the capabilities the
	* child may use must not strip the machinery it answers through.
	*
	* Reading the exempt set as "the global layer" instead of "not mine" held
	* only while every model-facing tool sat in the host composition. Once
	* presets moved them onto the agent plane they became an ANCESTOR
	* contribution, so a child's filter silently stopped constraining anything
	* it was given.
	* @param scope - the viewing scope (the agent), or undefined for the global view.
	* @returns the complete derived view for that scope.
	*/
	view(scope) {
		const layers = this.layers.chainLayers(scope);
		const own = this.layers.peek(scope);
		const inherited = new Map(this.layers.global.tools.entries());
		for (const layer of layers) {
			if (layer === own) continue;
			for (const [name, definition] of layer.tools.entries()) inherited.set(name, definition);
		}
		const visible = /* @__PURE__ */ new Map();
		const knownNames = /* @__PURE__ */ new Set();
		const restrictableNames = /* @__PURE__ */ new Set();
		for (const [name, definition] of inherited) {
			knownNames.add(name);
			restrictableNames.add(name);
			if (layers.every((layer) => layer.admits(name))) visible.set(name, definition);
		}
		if (own !== void 0) for (const [name, definition] of own.tools.entries()) {
			knownNames.add(name);
			visible.set(name, definition);
		}
		if (this.modeFor(scope) !== "native") visible.set(RUN_CODE_NAME, this.requireCodeTransport());
		return {
			visible,
			knownNames,
			restrictableNames
		};
	}
	/**
	* Look up a tool as one scope sees it (scoped
	* shadows global; a restricted-away global reads as absent). Presenters pass
	* the calling agent so the rendered card matches the definition that
	* actually executed.
	* @param name - the tool name as registered.
	* @param scope - the viewing scope (the agent); omitted = the global view.
	* @returns the definition the scope resolves, or undefined when none is visible.
	*/
	get(name, scope) {
		return this.view(scope).visible.get(name);
	}
	/**
	* Resolve the definition that MAY EXECUTE for a call, applying the mode
	* collapse at the operation boundary that owns it. The registry view
	* (`get`) is presentation-agnostic; here a MODEL-DIRECT call under `ptc`
	* may only name the reserved `run_code` transport, while a nested
	* sub-dispatch (a `parent` token set — the `run_code` SDK calling a tool
	* it bound) may call any visible tool. Denial surfaces as `UNKNOWN_TOOL`
	* through the executor, matching an absent definition.
	* @param name - the tool name as registered.
	* @param scope - the viewing scope (the agent); omitted = the global view.
	* @param nested - whether the call is a transport sub-dispatch, not a model-direct call.
	* @returns the definition that may run, or undefined when the call must be rejected.
	*/
	resolveExecution(name, scope, nested) {
		const tool = this.get(name, scope);
		if (tool === void 0) return void 0;
		if (this.collapses(name, scope, nested)) return void 0;
		return tool;
	}
	/**
	* Project visible definitions onto the allowlisted model-facing schema fields,
	* excluding execution and presentation callbacks.
	* @param scope - the viewing scope (the agent); omitted = the global view.
	* @returns one deep-cloned schema per visible tool.
	*/
	schemas(scope) {
		return [...this.view(scope).visible.values()].map((definition) => this.schemaOf(definition, true));
	}
	/** Project visible callable tools onto the generated PTC mode SDK contract. */
	sdkSchemas(scope) {
		return [...this.view(scope).visible.values()].filter((definition) => definition.name !== RUN_CODE_NAME).map((definition) => {
			const output = snapshotJsonValue(definition.output.schema);
			/* v8 ignore next -- registration already validated and retained this schema as lossless JSON. */
			if (output === void 0) throw new Error(`tool "${definition.name}" output schema must be lossless JSON before SDK projection`);
			return {
				...this.schemaOf(definition, true),
				output
			};
		});
	}
	/** Project one definition onto the model-facing schema fields. */
	schemaOf(definition, detachParameters) {
		const { name, description, parameters } = definition;
		const detached = detachParameters ? snapshotJsonValue(parameters) : parameters;
		if (detached === void 0) throw new Error(`tool "${name}" parameters must be lossless JSON before schema projection`);
		return {
			name,
			description,
			parameters: detached
		};
	}
	/**
	* Classify a pending call through the caller's visible tool definition. Only
	* an exact `true` is parallel; unknown, hidden, undeclared, invalid, or
	* throwing classifiers are exclusive.
	* @param exec - call name, parsed arguments, and optional agent scope.
	* @returns the fail-closed scheduling mode.
	*/
	executionMode(exec) {
		const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
		if (!tool?.isConcurrencySafe) return { kind: "exclusive" };
		try {
			return tool.isConcurrencySafe(exec.arguments) === true ? { kind: "parallel" } : { kind: "exclusive" };
		} catch {
			return { kind: "exclusive" };
		}
	}
	/**
	* Run the `tools/ptc-dispatch-log` waterfall over one settled sub-dispatch
	* and return the content the bridge should log on `tool/code-dispatch`.
	* Contained: when a listener throws, the method logs the original settled
	* content; that failure must not fail the dispatch or omit the settle event. Private:
	* the ONE consumer is the `run_code` bridge this registry constructs, which
	* receives it as a capability parameter (the `requireRuntime` idiom) — the
	* waterfall, not this invoker, is the public extension point.
	*/
	async shapeDispatchLog(dispatch) {
		try {
			return await this.ctx.waterfall(scopeTarget(this, dispatch.agent), "tools/ptc-dispatch-log", dispatch, () => Promise.resolve(dispatch.content));
		} catch (error) {
			this.ctx.logger.warn(`tools: ptc-dispatch-log listener failed for ${dispatch.name}: ${errorMessage(error)}; logging the original settled content`);
			return dispatch.content;
		}
	}
	/**
	* Whether the `ptc` mode collapse denies a model-direct call: only the
	* reserved `run_code` transport may be named. Nested sub-dispatches (a
	* `parent` token set) bypass the collapse. One home for the
	* security-relevant predicate, shared by {@link resolveExecution} and
	* {@link createExecution} so the two can never drift apart.
	*
	* Resolved through {@link modeFor}, NOT `defaultMode`: an agent given `ptc`
	* by an agent preset under a native deployment is the composition
	* `dsh-agent-tool-presentation` exists for, and reading the deployment default would
	* leave exactly that agent uncollapsed — announcing one surface while
	* executing another, which is the bypass this collapse closes.
	* @param name - the tool name as registered.
	* @param scope - the viewing scope whose effective presentation mode applies.
	* @param nested - whether the call is a transport sub-dispatch, not a model-direct call.
	*/
	collapses(name, scope, nested) {
		return !nested && this.modeFor(scope) === "ptc" && name !== "run_code";
	}
	/**
	* Execute through pre-policy, guards, around-dispatch, post-policy,
	* definition-owned content finalization, and final notification. Tool and
	* listener failures resolve as materialized error results; an invisible tool
	* reports `UNKNOWN_TOOL`. The returned outcome is the same lossless, frozen
	* snapshot final observers receive. Cancellation
	* arriving after entry and before final result materialization skips a
	* not-yet-started body with `ABORTED_BEFORE_DISPATCH` or replaces a
	* successful started outcome with `ABORTED`; already-started work is still
	* drained and may retain a tool-owned structured error.
	* @param exec - the typed same-process call input. The registry assigns its
	*   correlation token before policy begins.
	* @returns the materialized final result.
	*/
	async execute(exec) {
		return this.prepareExecution(exec, (prepared) => this.completeScheduledExecution(prepared));
	}
	async completeScheduledExecution(prepared) {
		switch (prepared.kind) {
			case "dispatch": {
				const dispatched = await this.dispatchScheduledExecution(prepared.exec);
				return dispatched.kind === "post-result" ? await this.finalizeScheduledExecution(prepared.exec, dispatched.result) : this.finishScheduledExecution(prepared.exec, dispatched.result);
			}
			case "post-result": return await this.finalizeScheduledExecution(prepared.exec, prepared.result);
			case "final-result": return this.finishScheduledExecution(prepared.exec, prepared.result);
			/* v8 ignore next -- closed-union exhaustiveness guard */
			default: return assertNever(prepared, "scheduled tool preparation");
		}
	}
	createExecution(exec) {
		const deferredContexts = [];
		const token = createExecutionToken();
		const callId = exec.callId;
		const rootCallId = exec.rootCallId ?? callId;
		const name = exec.name;
		const agent = exec.agent;
		const parent = exec.parent;
		const signal = exec.signal;
		const visible = this.get(name, agent);
		const collapsed = visible !== void 0 && this.collapses(name, agent, parent !== void 0);
		const concludingExecutions = this.concludingExecutions;
		const base = {
			token,
			callId,
			rootCallId,
			name,
			signal,
			...agent !== void 0 ? { agent } : {},
			...parent !== void 0 ? { parent } : {},
			deferContext(context) {
				deferredContexts.push(context);
			},
			concludeTurn() {
				concludingExecutions.add(this);
			}
		};
		const capturedFinalizer = visible?.finalizeContent?.bind(visible);
		const finalizerFor = () => collapsed && !signal.aborted ? void 0 : capturedFinalizer;
		try {
			const detached = snapshotJsonValue(exec.arguments);
			if (detached === void 0) throw new TypeError("tool execution arguments must be losslessly JSON-serializable");
			const execution = {
				...base,
				arguments: deepFreeze$1(detached)
			};
			this.deferredContexts.set(execution, deferredContexts);
			this.contentFinalizers.set(execution, finalizerFor());
			this.cancellationStates.set(execution, {
				callerSignal: signal,
				bodyInvoked: false
			});
			if (collapsed) {
				if (signal.aborted) return {
					kind: "final-result",
					exec: execution,
					result: toolAbortedBeforeDispatchResult()
				};
				return {
					kind: "final-result",
					exec: execution,
					result: toolErrorResult(new ToolNotFoundError(name, `only \`${RUN_CODE_NAME}\` is callable directly — call \`${name}\` from inside a \`${RUN_CODE_NAME}\` program instead`))
				};
			}
			return {
				kind: "ready",
				exec: execution
			};
		} catch (error) {
			const execution = {
				...base,
				arguments: void 0
			};
			this.contentFinalizers.set(execution, finalizerFor());
			return {
				kind: "final-result",
				exec: execution,
				result: toolErrorResult(error)
			};
		}
	}
	/**
	* Run the ordered pre-execute and monotonic guard stages for the scheduler.
	* @param input - the caller-supplied execution input.
	* @returns the prepared execution plus the next scheduler stage.
	* @internal
	*/
	async prepareScheduledExecution(input) {
		return this.prepareExecution(input, (prepared) => prepared);
	}
	async prepareExecution(input, next) {
		const created = this.createExecution(input);
		if (created.kind !== "ready") return next(created);
		const exec = created.exec;
		if (this.callerCancelled(exec)) return next({
			kind: "final-result",
			exec,
			result: toolAbortedBeforeDispatchResult()
		});
		try {
			const carrier = scopeTarget(this, exec.agent);
			const gate = await this.ctx.waterfall(carrier, "tools/pre-execute", exec, () => Promise.resolve({ kind: "allow" }));
			const askResolution = gate.kind === "ask" ? await this.serviceAsk(exec, gate) : {
				decision: gate,
				approvalCancelled: false
			};
			const { decision } = askResolution;
			if (this.callerCancelled(exec) && askResolution.approvalCancelled) return await next({
				kind: "post-result",
				exec,
				result: toolAbortedBeforeDispatchResult()
			});
			const denialReason = decision.kind === "allow" ? this.guardReason(exec) : decision.reason;
			if (denialReason !== void 0) return await next({
				kind: "post-result",
				exec,
				result: this.materializeFinalResult({
					content: [{
						type: "text",
						text: `Error: ${denialReason}`
					}],
					isError: true,
					error: { message: denialReason }
				})
			});
			if (this.callerCancelled(exec)) return await next({
				kind: "post-result",
				exec,
				result: toolAbortedBeforeDispatchResult()
			});
			return await next({
				kind: "dispatch",
				exec
			});
		} catch (error) {
			return next({
				kind: "final-result",
				exec,
				result: toolErrorResult(error)
			});
		}
	}
	/** Whether the original caller signal is currently aborted. */
	callerCancelled(exec) {
		const state = this.cancellationStates.get(exec);
		/* v8 ignore next -- only registry-minted executions reach the staged scheduler methods */
		if (state === void 0) throw new Error("tool registry scheduler invariant violated: missing cancellation state");
		return state.callerSignal.aborted;
	}
	/** Canonical cancellation outcome selected by whether the tool body started. */
	cancellationResult(exec, prior) {
		const state = this.cancellationStates.get(exec);
		/* v8 ignore next -- only registry-minted executions reach the staged scheduler methods */
		if (state === void 0) throw new Error("tool registry scheduler invariant violated: missing cancellation state");
		return state.bodyInvoked ? toolAbortedResult(prior) : toolAbortedBeforeDispatchResult(prior);
	}
	/**
	* Dispatch the registered body with the original caller signal fused back
	* into any around-wrapper replacement. Cancellation never abandons the body:
	* a started promise reaches quiescence before its outcome becomes `ABORTED`.
	*/
	async dispatchToolBody(exec) {
		const state = this.cancellationStates.get(exec);
		/* v8 ignore next -- only registry-minted executions reach the staged scheduler methods */
		if (state === void 0) throw new Error("tool registry scheduler invariant violated: missing cancellation state");
		const wrapperSignal = exec.signal;
		const fused = fuseToolSignals(state.callerSignal, wrapperSignal);
		const signal = fused.signal;
		if (isAborted(signal)) {
			fused.dispose();
			return toolAbortedBeforeDispatchResult();
		}
		exec.signal = signal;
		try {
			const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
			if (!tool) throw new ToolNotFoundError(exec.name);
			state.bodyInvoked = true;
			const returned = await tool.execute(exec.arguments, exec);
			const result = this.createSuccessResult(exec, tool, returned);
			return isAborted(signal) ? toolAbortedResult(result) : result;
		} catch (error) {
			return toolErrorResult(error);
		} finally {
			fused.dispose();
			exec.signal = wrapperSignal;
		}
	}
	/**
	* Run around-dispatch and the tool body. Tool and unknown-tool failures still
	* receive post-execute; pipeline failures are already final.
	* @param exec - the prepared execution.
	* @returns whether the result still needs post-execute.
	* @internal
	*/
	async dispatchScheduledExecution(exec) {
		try {
			const mutableExec = exec;
			const carrier = scopeTarget(this, exec.agent);
			const result = await this.ctx.waterfall(carrier, "tools/execute", mutableExec, () => this.dispatchToolBody(mutableExec));
			const normalized = this.normalizeDispatchResult(exec, result);
			const deferredContexts = this.deferredContexts.get(exec);
			/* v8 ignore next -- dispatch only receives executions minted by this registry's prepare stage */
			if (deferredContexts === void 0) throw new Error("tool registry scheduler invariant violated: unprepared execution");
			const resultWithDeferredContexts = deferredContexts.length === 0 ? normalized : this.markCanonical(exec, {
				...normalized,
				additionalContexts: [...deferredContexts, ...normalized.additionalContexts ?? []]
			});
			return {
				kind: "post-result",
				result: this.callerCancelled(exec) && !resultWithDeferredContexts.isError ? this.cancellationResult(exec, resultWithDeferredContexts) : resultWithDeferredContexts
			};
		} catch (error) {
			return {
				kind: "final-result",
				result: toolErrorResult(error)
			};
		}
	}
	/**
	* Run ordered post-execute, then apply definition-owned content finalization,
	* materialize, and notify the final outcome.
	* @param exec - the prepared execution.
	* @param result - dispatch/pre result that still needs post-execute.
	* @returns the materialized final result.
	* @internal
	*/
	async finalizeScheduledExecution(exec, result) {
		try {
			const postResult = await this.postExecute(exec, result);
			return this.finishScheduledExecution(exec, this.callerCancelled(exec) && !postResult.isError ? this.cancellationResult(exec, postResult) : postResult);
		} catch (error) {
			return this.finishScheduledExecution(exec, toolErrorResult(error));
		}
	}
	/**
	* Materialize the candidate, apply definition-owned content finalization,
	* then materialize and notify the authoritative result.
	* @param exec - the prepared execution.
	* @param result - final result.
	* @returns the materialized final result.
	* @internal
	*/
	finishScheduledExecution(exec, result) {
		let materializedResult;
		try {
			materializedResult = this.materializeFinalResult(result);
		} catch (error) {
			materializedResult = this.materializeFinalResult(toolErrorResult(error));
		}
		let finalResult;
		try {
			finalResult = this.materializeFinalResult(this.applyFinalContent(exec, materializedResult));
		} catch (error) {
			finalResult = this.materializeFinalResult(toolErrorResult(error));
		}
		this.notifyResult(exec, finalResult);
		return finalResult;
	}
	/** Apply the snapshotted tool-owned content transform without exposing other result fields. */
	applyFinalContent(exec, result) {
		const finalizeContent = this.contentFinalizers.get(exec);
		if (finalizeContent === void 0) return result;
		const content = finalizeContent(exec, result);
		return content === void 0 ? result : {
			...result,
			content
		};
	}
	/** Notify observers without exposing a mutation or error channel into the outcome. */
	notifyResult(exec, result) {
		Object.freeze(exec);
		const { name: toolName, callId } = exec;
		const reportFailure = (error) => {
			this.ctx.logger.warn(`tool "${toolName}" (${callId}): tools/result observer failed: ${errorMessage(error)}`);
		};
		const callbacks = this.ctx.events.dispatch("emit", [
			scopeTarget(this, exec.agent),
			"tools/result",
			exec,
			result
		]);
		for (const callback of callbacks) try {
			const returned = callback(exec, result);
			Promise.resolve(returned).catch(reportFailure);
		} catch (error) {
			reportFailure(error);
		}
	}
	/**
	* Resolve an `ask` decision to allow/deny through the approval seam. The
	* seam is consumed opportunistically with `ctx.get('approval')` — a
	* deployment that composes no ApprovalService keeps the historical degrade
	* to deny, and an unmount mid-session degrades the same way on the next ask.
	* An agent-less execution also degrades: without an agent there is no
	* session to audit to and no UI to route to. Otherwise the outcome maps
	* one-to-one — `allowed-once` proceeds; the three non-grants deny with
	* distinct reasons so the model can tell a human "no" from an absent
	* approval channel.
	*/
	async serviceAsk(exec, ask) {
		const approval = this.ctx.get("approval");
		if (approval === void 0) return {
			decision: {
				kind: "deny",
				reason: ask.reason ?? `tool "${exec.name}" requires approval (not yet supported)`
			},
			approvalCancelled: false
		};
		if (exec.agent === void 0) return {
			decision: {
				kind: "deny",
				reason: `tool "${exec.name}" requires approval, but the call has no agent to route it through`
			},
			approvalCancelled: false
		};
		const outcome = await approval.request({
			agent: exec.agent,
			toolName: exec.name,
			callId: exec.callId,
			...ask.reason !== void 0 ? { reason: ask.reason } : {},
			signal: exec.signal
		});
		switch (outcome) {
			case "allowed-once": return {
				decision: { kind: "allow" },
				approvalCancelled: false
			};
			case "rejected": return {
				decision: {
					kind: "deny",
					reason: `the user rejected tool "${exec.name}"`
				},
				approvalCancelled: false
			};
			case "cancelled": return {
				decision: {
					kind: "deny",
					reason: `approval for tool "${exec.name}" was cancelled`
				},
				approvalCancelled: true
			};
			case "unavailable": return {
				decision: {
					kind: "deny",
					reason: `tool "${exec.name}" requires approval, but no approval channel is available`
				},
				approvalCancelled: false
			};
			default: return assertNever(outcome, "ApprovalOutcome");
		}
	}
	/**
	* Run the `tools/post-execute` waterfall over a dispatched `result` and apply
	* its {@link PostToolDecision}: `accept` keeps the call successful (replacing
	* `content` when given), `block` turns it into an `isError` whose content is
	* the corrective `feedback`. Either decision may attach `additionalContexts`,
	* which are ferried on the returned result for the loop's active-batch FIFO.
	* Context deferred by the tool body survives an accepted result but is
	* discarded when the outer call is blocked; a block exposes only context the
	* blocking decision explicitly supplied.
	* Runs inside `execute`'s outer try/catch (a throwing listener → isError).
	*/
	async postExecute(exec, result) {
		const decision = await this.ctx.waterfall(scopeTarget(this, exec.agent), "tools/post-execute", exec, result, () => Promise.resolve({ kind: "accept" }));
		const decisionContexts = decision.additionalContexts ?? [];
		if (decision.kind === "block") {
			const message = failureMessageFromContent(decision.feedback);
			return this.markCanonical(exec, {
				content: decision.feedback,
				isError: true,
				error: { message },
				...decisionContexts.length > 0 ? { additionalContexts: decisionContexts } : {}
			});
		}
		if (Object.hasOwn(decision, "content") && Object.hasOwn(decision, "value")) throw new TypeError("tools/post-execute accept decision cannot replace both value and content");
		const additionalContexts = [...result.additionalContexts ?? [], ...decisionContexts];
		if (Object.hasOwn(decision, "value")) {
			if (result.isError) throw new TypeError("tools/post-execute cannot replace the value of a failed result");
			const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
			if (tool === void 0) throw new ToolNotFoundError(exec.name);
			const replaced = this.createSuccessResult(exec, tool, decision.value);
			return this.markCanonical(exec, {
				...replaced,
				...additionalContexts.length > 0 ? { additionalContexts } : {}
			});
		}
		return this.markCanonical(exec, {
			...result,
			...decision.content !== void 0 ? { content: decision.content } : {},
			...additionalContexts.length > 0 ? { additionalContexts } : {}
		});
	}
	/** Registry-normalized results and the exact dispatch that validated each value. */
	canonicalResults = /* @__PURE__ */ new WeakMap();
	/** Mark one registry-normalized result as canonical only for its owning dispatch. */
	markCanonical(exec, result) {
		this.canonicalResults.set(result, exec.token);
		return result;
	}
	/** Snapshot, validate, render, and optionally project one successful body value. */
	createSuccessResult(exec, tool, candidate) {
		const detached = snapshotToolValue(tool.name, candidate);
		const violations = validateJsonSchemaValue(tool.output.schema, detached, "value");
		if (violations.length > 0) throw new ToolOutputError(tool.name, violations);
		const value = deepFreeze$1(detached);
		let rendered;
		try {
			rendered = tool.output.render(exec.arguments, value);
		} catch (error) {
			throw projectionError(tool.name, "render", error);
		}
		const content = snapshotProjection(tool.name, "render", rendered);
		let meta;
		if (exec.parent === void 0 && tool.output.presentationMeta !== void 0) {
			let projected;
			try {
				projected = tool.output.presentationMeta(exec.arguments, value);
			} catch (error) {
				throw projectionError(tool.name, "presentationMeta", error);
			}
			meta = snapshotProjection(tool.name, "presentationMeta", projected);
		}
		const concludesTurn = this.concludingExecutions.has(exec);
		return this.markCanonical(exec, this.materializeFinalResult({
			isError: false,
			value,
			content,
			...meta !== void 0 ? { meta } : {},
			...concludesTurn ? { concludesTurn: true } : {}
		}));
	}
	/** Normalize an around-dispatch wrapper's authored result through the owning output contract. */
	normalizeDispatchResult(exec, result) {
		if (this.canonicalResults.get(result) === exec.token) return result;
		if (result.isError) return this.markCanonical(exec, {
			isError: true,
			error: result.error,
			content: result.content,
			...result.meta !== void 0 ? { meta: result.meta } : {},
			...result.additionalContexts !== void 0 ? { additionalContexts: result.additionalContexts } : {}
		});
		const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== void 0);
		if (tool === void 0) throw new ToolNotFoundError(exec.name);
		const normalized = this.createSuccessResult(exec, tool, result.value);
		return this.markCanonical(exec, {
			...normalized,
			...result.additionalContexts !== void 0 ? { additionalContexts: result.additionalContexts } : {}
		});
	}
	/** Materialize the authoritative commit outcome once, immediately before `tools/result`. */
	materializeFinalResult(result) {
		const presentation = {
			content: result.content,
			...result.meta !== void 0 ? { meta: result.meta } : {},
			...result.additionalContexts !== void 0 ? { additionalContexts: result.additionalContexts } : {}
		};
		if (result.isError) return materializePresentation({
			isError: true,
			error: result.error,
			...presentation
		});
		return deepFreeze$1({
			...materializePresentation({
				isError: false,
				...presentation,
				...result.concludesTurn === true ? { concludesTurn: true } : {}
			}),
			value: result.value
		});
	}
});
/** Mint a same-process correlation token whose identity is its value. */
function createExecutionToken() {
	return Symbol("dsh.tool.execution");
}
function toolErrorResult(error) {
	const info = errorInfo(error);
	const message = errorMessage(error);
	return {
		content: [{
			type: "text",
			text: `Error: ${message}`
		}],
		isError: true,
		error: {
			message,
			...info ? { info } : {}
		}
	};
}
/** Read live abort state across an await without treating it as synchronously immutable. */
function isAborted(signal) {
	return signal.aborted;
}
/**
* Fuse caller and wrapper cancellation without nesting `AbortSignal.any`.
* Keeping the relay dispatch-scoped also removes listeners when work settles.
*/
function fuseToolSignals(caller, wrapper) {
	if (caller === wrapper) return {
		signal: caller,
		dispose() {}
	};
	const controller = new AbortController();
	let listening = false;
	const dispose = () => {
		if (!listening) return;
		listening = false;
		caller.removeEventListener("abort", abortFromCaller);
		wrapper.removeEventListener("abort", abortFromWrapper);
	};
	const abortFrom = (source) => {
		const reason = source.reason;
		controller.abort(reason);
		dispose();
	};
	const abortFromCaller = () => {
		abortFrom(caller);
	};
	const abortFromWrapper = () => {
		abortFrom(wrapper);
	};
	if (wrapper.aborted) abortFromWrapper();
	else if (caller.aborted) abortFromCaller();
	else {
		listening = true;
		caller.addEventListener("abort", abortFromCaller, { once: true });
		wrapper.addEventListener("abort", abortFromWrapper, { once: true });
	}
	return {
		signal: controller.signal,
		dispose
	};
}
/** Canonical result when cancellation supersedes success after body invocation. */
function toolAbortedResult(prior) {
	const additionalContexts = prior?.additionalContexts ?? [];
	return {
		content: [{
			type: "text",
			text: "Error: tool call aborted"
		}],
		isError: true,
		error: {
			message: "tool call aborted",
			info: {
				name: "AbortError",
				code: TOOL_ABORTED
			}
		},
		...additionalContexts.length > 0 ? { additionalContexts } : {}
	};
}
/** Canonical result when cancellation prevents tool body invocation. */
function toolAbortedBeforeDispatchResult(prior) {
	const additionalContexts = prior?.additionalContexts ?? [];
	return {
		content: [{
			type: "text",
			text: "Error: tool call aborted before dispatch"
		}],
		isError: true,
		error: {
			message: "tool call aborted before dispatch",
			info: {
				name: "AbortError",
				code: TOOL_ABORTED_BEFORE_DISPATCH
			}
		},
		...additionalContexts.length > 0 ? { additionalContexts } : {}
	};
}
Service.init;
/**
* Value mirror of the `FiberState` members {@link isUnloading} compares
* against: a const enum has no runtime object to import, and the value is
* needed at runtime (same rationale as the CLI boot driver's mirror).
*/
const FIBER_DISPOSED = 4;
const FIBER_UNLOADING = 5;
/** Whether the consumer's own fiber is tearing down (not just losing the settings service). */
function isUnloading(ctx) {
	const state = ctx.fiber.state;
	return state === FIBER_UNLOADING || state === FIBER_DISPOSED;
}
/**
* Install the canonical optional-settings consumer wiring: while a settings
* service exists, register `ns` with the consumer's composition entry as the
* `base` layer and point the source thunk at the resolved scope; when the
* service goes away (disposal, provider reload), fall back to the entry so
* the consumer keeps working exactly as composed. The registration rides the
* scoped fiber, so no settings service ever mounted means none of this runs.
* @param ctx - consumer plugin context owning the wiring.
* @param ns - the consumer-owned settings namespace.
* @param schema - schema resolving the namespace (typically the plugin Config).
* @param entry - the consumer's composition entry config, used as `base`.
* @param hooks - source sink and change notification.
*/
function installSettingsSection(ctx, ns, schema, entry, hooks) {
	ctx.inject(["settings"], (sctx) => {
		let scope;
		try {
			scope = sctx.settings.register(ns, schema, {
				base: entry,
				...hooks.validate === void 0 ? {} : { validate: hooks.validate }
			});
		} catch (error) {
			sctx.logger.warn("settings: registration for \"%s\" failed; falling back to the composition config this boot", ns);
			sctx.logger.warn(error);
			try {
				hooks.setSource(() => entry);
				hooks.onChange();
			} catch {}
			return;
		}
		hooks.setSource(() => scope.get());
		sctx.effect(() => () => {
			if (isUnloading(ctx)) return;
			hooks.setSource(() => entry);
			hooks.onChange();
		});
		hooks.onChange();
		scope.watch(() => {
			if (isUnloading(ctx)) return;
			hooks.onChange();
		});
	});
}
//#endregion
//#region src/index.ts
const pwRequire = createRequire(import.meta.url);
const name = "@dsh-external/dsh-manuscript-tracker";
const inject = [
	"tools",
	"timer",
	"webServer",
	"agents",
	"sessions",
	"llm"
];
const Config = Schema.object({
	journals: Schema.array(Schema.object({
		name: Schema.string(),
		baseUrl: Schema.string(),
		username: Schema.string(),
		password: Schema.string(),
		sections: Schema.array(Schema.string()).default([]),
		system: Schema.string().default("editorial-manager"),
		structure: Schema.object({
		  source: Schema.string().default("llm"),
		  model: Schema.string().default(""),
		  capturedAt: Schema.string().default(""),
		  name: Schema.string().default(""),
		  system: Schema.string().default(""),
		  groups: Schema.array(Schema.object({ title: Schema.string().default(""), sections: Schema.array(Schema.string()).default([]) })).default([]),
		  sections: Schema.array(Schema.object({ name: Schema.string().default(""), kind: Schema.string().default("active"), check: Schema.boolean().default(true) })).default([])
		}),
	})).default([]),
	time: Schema.string().default("08:00"),
	timezone: Schema.string().default("Asia/Shanghai"),
	scheduleEnabled: Schema.boolean().default(true),
	serverchanKey: Schema.string().default(""),
	reportDir: Schema.string().default(""),
	reportSessionId: Schema.string().default(""),
	discoverProvider: Schema.string().default(""),
	discoverModel: Schema.string().default(""),
	browserPath: Schema.string().default(""),
	// [patch 2026-10-22t] 已结束（出版/发表/拒稿…）投稿的追溯范围，单位：月，最小 1
	endedMonths: Schema.number().default(1)
});

// [local patch 2026-10-10] DSH 0.2 settings service refuses writes unless the schema is volatile
// (dsh-settings volatileForm()/isVolatilePath() read schema.meta.volatile). This plugin bundles its
// own older schemastery WITHOUT .volatile(), so meta is marked directly; guarded by try/catch so a
// missing or renamed API can never break module evaluation. Re-apply with fix-volatile.cjs after updates.
try { if (Config && Config.meta && Config.meta.volatile !== true) Config.meta.volatile = true; } catch (e) { /* ignore */ }
const __pcSeenSchema = /* @__PURE__ */ new Set();
const __pcMark = (o, depth = 0) => {
  try {
    if (o === null || o === undefined || depth > 6 || __pcSeenSchema.has(o)) return;
    if (typeof o !== "object" && typeof o !== "function") return;
    __pcSeenSchema.add(o);
    if (o.meta && typeof o.meta === "object") o.meta.volatile = true;
    for (const k of Object.keys(o)) { try { __pcMark(o[k], depth + 1); } catch (e) { /* ignore */ } }
  } catch (e) { /* ignore */ }
};
__pcMark(Config);
const STATUS_ZH = {
	"Under Review": "审稿中",
	"With Editor": "编辑处理中",
	"With Editorial Office": "编辑部处理中",
	"Required Reviews Completed": "审稿完成",
	"Decision in Process": "决策中",
	"Reviewers Assigned": "已指派审稿人",
	"Reviewers Invited": "已邀请审稿人",
	"Awaiting Reviewer Selection": "等待选择审稿人",
	"Awaiting Reviewer Scores": "等待审稿意见",
	"Awaiting EIC Assignment": "等待主编指派",
	"Submitted": "已投稿",
	"Submission": "已投稿",
	"Transfer": "已转投",
	"Transferred": "已转投",
	"Withdrawn": "已撤稿",
	"Declined": "已婉拒",
	"Sent Back to Author": "退回作者",
	"Incomplete": "信息不完整",
	"Waiting for Approval": "等待批准",
	"Awaiting Author Approval": "等待作者确认",
	"Submissions Being Processed": "处理中",
	"Submissions Needing Revision": "需要修改",
	"Major Revision": "大修",
	"Minor Revision": "小修",
	"Revise": "修改中",
	"Revised": "已修改",
	"Under Revision": "修改中",
	"Revisions Being Processed": "修改处理中",
	"Revisions Under Review": "修改稿审稿中",
	"Incomplete Submissions Being Revised": "修改信息不完整",
	"Date Revision Began": "修改开始",
	"Date Revision Due": "修改截止",
	"In Production": "生产中",
	"Production": "生产中",
	"With Production": "生产中",
	"Proofs Available": "校样可获取",
	"Proofs Sent": "校样已发送",
	"Issue Assigned": "已分配刊期",
	"Completed": "已完成",
	"Accepted": "已接受",
	"Rejected": "已拒稿"
};
/** 状态翻译：精确表优先，其次前缀/关键词兜底。 */
const zh = (s) => {
	const t = (s || "").trim();
	if (!t) return "";
	if (STATUS_ZH[t]) return STATUS_ZH[t];
	if (/reject/i.test(t)) return "已拒稿";
	if (/accept/i.test(t)) return "已接受";
	if (/production/i.test(t)) return "生产中";
	if (/revis/i.test(t)) return "修改中";
	if (/^under review/i.test(t)) return "审稿中";
	if (/reviewer/i.test(t)) return "审稿中";
	if (/^withdraw/i.test(t)) return "已撤稿";
	return t;
};
function defaultReportDir() {
	return join(homedir(), ".dsh", "manuscript-tracker", "reports");
}
function log(reportDir, msg) {
	try {
		const dir = reportDir || defaultReportDir();
		mkdirSync(dir, { recursive: true });
		appendFileSync(join(dir, "run.log"), "[" + (/* @__PURE__ */ new Date()).toISOString() + "] " + msg + "\n");
	} catch {}
}
async function readBody(req) {
	const chunks = [];
	for await (const c of req) chunks.push(Buffer.from(c));
	return Buffer.concat(chunks).toString("utf8");
}
function nowInTz(timezone) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	}).formatToParts(/* @__PURE__ */ new Date());
	const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
	return {
		date: `${get("year")}-${get("month")}-${get("day")}`,
		time: `${get("hour")}:${get("minute")}`
	};
}
async function waitForFrame(page, budgetMs = 45e3) {
	const deadline = Date.now() + budgetMs;
	let fallback = null;
	while (Date.now() < deadline) {
		for (const f of page.frames()) {
			if (f === page.mainFrame()) continue;
			const url = f.url() || "";
			if (url.includes("login.asp") || url.includes("login.aspx")) return f;
			if (url && !url.includes("about:blank") && !fallback) fallback = f;
		}
		for (const f of page.frames()) {
			if (f === page.mainFrame()) continue;
			const has = await f.$("input[name='username']").then((x) => !!x).catch(() => false);
			if (has) return f;
		}
		await page.waitForTimeout(500);
	}
	return fallback ?? page.frame({ name: "content" });
}
/**
 * 打开期刊登录页并把登录帧准备到「可见」状态，失败自动重试。
 * EM 偶发会在 about:blank 停留很久；原先一次不成整轮就失败（每日抓取同样受益于重试）。
 */
// [local patch] DSH 的设置变更不会推给插件进程（实测落盘已更新、进程内仍旧），所以直接读 profile patch。
// 极简 YAML 子集解析：按缩进递归，支持 key: value、嵌套映射、"- " 序列、引号字符串、[]、true/false/数字。
function __pcScalar(v) {
  if (v === "\"\"" || v === "''") return "";
  if (v.length > 1 && ((v[0] === "\"" && v[v.length - 1] === "\"") || (v[0] === "'" && v[v.length - 1] === "'"))) return v.slice(1, -1);
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "[]") return [];
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
function __pcYaml(text) {
  const lines = text.split(/\r?\n/);
  const parse = (i, indent) => {
    let seq = null, map = null;
    while (i < lines.length) {
      const raw = lines[i];
      const s = raw.trim();
      if (s === "" || s.startsWith("#")) { i++; continue; }
      const ind = raw.match(/^ */)[0].length;
      if (ind < indent) break;
      if (ind > indent) { i++; continue; }
      const body = raw.slice(indent);
      const keyRe = /^([A-Za-z_][\w.-]*):\s*(.*)$/;
      if (body.startsWith("- ")) {
        if (map) break;
        if (!seq) seq = [];
        const item = body.slice(2);
        const m = keyRe.exec(item);
        if (!m) { seq.push(__pcScalar(item.trim())); i++; continue; }
        const obj = {};
        if (m[2].trim() === "") { const r = parse(i + 1, indent + 4); obj[m[1]] = r[0]; i = r[1]; }
        else { obj[m[1]] = __pcScalar(m[2].trim()); i++; }
        while (i < lines.length) {
          const r2 = lines[i]; const s2 = r2.trim();
          if (s2 === "" || s2.startsWith("#")) { i++; continue; }
          if (r2.match(/^ */)[0].length !== indent + 2) break;
          const m2 = keyRe.exec(r2.slice(indent + 2));
          if (!m2) break;
          if (m2[2].trim() === "") { const r3 = parse(i + 1, indent + 4); obj[m2[1]] = r3[0]; i = r3[1]; }
          else { obj[m2[1]] = __pcScalar(m2[2].trim()); i++; }
        }
        seq.push(obj);
      } else {
        if (seq) break;
        if (!map) map = {};
        const m = keyRe.exec(body);
        if (!m) { i++; continue; }
        if (m[2].trim() === "") { const r = parse(i + 1, indent + 2); map[m[1]] = r[0]; i = r[1]; }
        else { map[m[1]] = __pcScalar(m[2].trim()); i++; }
      }
    }
    return [seq !== null ? seq : (map !== null ? map : null), i];
  };
  return parse(0, lines.findIndex((l) => l.trim().startsWith("- ")) === 0 ? 0 : 0)[0];
}
function readPersistedPC() {
  try {
    const root = join(homedir(), ".dsh", "profiles");
    const cands = [];
    for (const prof of readdirSync(root)) {
      const p = join(root, prof, "cordis.patch.yml");
      try { if (existsSync(p)) cands.push({ p, m: statSync(p).mtimeMs }); } catch (e) { /* ignore */ }
    }
    // 关键：DSH 只写当前 profile 的那份，取 mtime 最新的，避免读到其它/旧 profile 的值
    cands.sort((a, b) => b.m - a.m);
    for (const c of cands) {
      try {
        const text = readFileSync(c.p, "utf8");
        if (!text.includes("manuscript-tracker")) continue;
        const doc = __pcYaml(text);
        const arr = Array.isArray(doc) ? doc : (doc && typeof doc === "object" ? Object.values(doc)[0] : null);
        const list = Array.isArray(arr) ? arr : [];
        const entry = list.find((x) => x && x.name === "@dsh-external/dsh-manuscript-tracker") || list.find((x) => x && x.config);
        if (entry && entry.config) return entry.config;
      } catch (e) { /* 试下一份 */ }
    }
  } catch (e) { /* ignore */ }
  return null;
}

let __pcCtx = null;
let __pcCwdUsed = "";
// [local patch] 冷会话投递的关键第二半：把会话 attach 到它所属的 workspace。
// 依据宿主 dsh-api-session-controller 的 session.create 实现：
//   workspace = ctx.workspaceRegistry.get(workspaceId) → __pcAgents().ensureSession(...) → workspace.attachSession(id)
async function __pcAttachWorkspace(sessionId) {
  try {
    if (!__pcCtx) return "no-ctx";
    const reg = typeof __pcCtx.get === "function" ? __pcCtx.get("workspaceRegistry") : undefined;
    if (!reg || typeof reg.list !== "function") return "no-registry";
    const list = reg.list() || [];
    let w = list.find((x) => x && Array.isArray(x.sessionIds) && x.sessionIds.includes(sessionId));
    if (!w) {
      let cwd = "";
      try { cwd = cwdFromIndexPC(sessionId); } catch (e) { cwd = ""; }
      if (cwd) w = list.find((x) => x && x.path && String(x.path).toLowerCase() === String(cwd).toLowerCase());
    }
    if (!w) w = list[0];
    if (!w || typeof w.attachSession !== "function") return "no-workspace";
    await w.attachSession(sessionId);
    return "attached:" + String(w.id || w.path || "?");
  } catch (e) { return "attach-err:" + String(e && e.message ? e.message : e); }
}
// [local patch] 插件可见的 ctx.agents 没有 ensureSession；带它的内部服务是 sessionController.agents
// （服务枚举实证：sessionController 的键含 agents，而 agents 的键不含 ensureSession）
function __pcAgents() {
  try {
    const sc = (__pcCtx && typeof __pcCtx.get === "function") ? __pcCtx.get("sessionController") : null;
    if (sc && sc.agents && typeof sc.agents.ensureSession === "function") return sc.agents;
    if (sc && sc.agents) return sc.agents;
  } catch (e) { /* ignore */ }
  return __pcCtx && __pcCtx.agents ? __pcCtx.agents : null;
}
// [local patch] 冷对话投递：宿主里"打开会话"的公开入口是 sessionController（其内部执行
// ensureSession + workspace.attachSession）。插件可见的 ctx.agents 没有 ensureSession，
// 所以这里按"命令面/直接方法/内部 agent 控制器"依次尝试，全部失败则保持原行为（只报错）。
async function __pcLoadSession(sessionId, cwd) {
  try {
    // [local patch] cwd 为空会让宿主 ensureSession 执行 mkdir "" → ENOENT（实测错误原文）。
    // 依次回退：会话 header → workspace 记录里的路径 → 进程当前目录。__pcCwdFallback
    if (!cwd) {
      try { const s = (__pcCtx.sessions && __pcCtx.sessions.get) ? __pcCtx.sessions.get(sessionId) : null; cwd = (s && s.header && s.header.cwd) || ""; } catch (e) { /* ignore */ }
    }
    if (!cwd) {
      try {
        const reg = (typeof __pcCtx.get === "function") ? __pcCtx.get("workspaceRegistry") : null;
        const list = (reg && typeof reg.list === "function") ? (reg.list() || []) : [];
        for (const w of list) {
          const p = (w && w.record && (w.record.path || w.record.cwd)) || (w && w.path) || "";
          if (p) { cwd = String(p); break; }
        }
      } catch (e) { /* ignore */ }
    }
    // [local patch] 权威 cwd 来源：storages/workspace.json 的 workspaces 表里，
    // 哪个 workspace 的 sessionIds 含该会话，它的 path 就是该会话的 cwd。__pcWorkspaceJsonCwd
    if (!cwd) {
      try {
        const __home = process.env.DSH_HOME || join(homedir(), ".dsh");
        const __wp = join(__home, "storages", "workspace.json");
        if (existsSync(__wp)) {
          const __j = JSON.parse(readFileSync(__wp, "utf8"));
          const __tbl = (__j && __j.tables && __j.tables.workspaces) || {};
          for (const __k of Object.keys(__tbl)) {
            const __w = __tbl[__k];
            if (__w && Array.isArray(__w.sessionIds) && __w.sessionIds.includes(sessionId) && __w.path) { cwd = String(__w.path); break; }
          }
        }
      } catch (e) { /* ignore */ }
    }
    if (!cwd) { try { cwd = process.cwd() || ""; } catch (e) { /* ignore */ } }
    // [local patch] 无条件解析权威 cwd 并覆盖调用方值：__pcResolveCwd
    try {
      const __home = process.env.DSH_HOME || join(homedir(), ".dsh");
      let __c = "";
      const __wp = join(__home, "storages", "workspace.json");
      if (existsSync(__wp)) {
        const __j = JSON.parse(readFileSync(__wp, "utf8"));
        const __tbl = (__j && __j.tables && __j.tables.workspaces) || {};
        for (const __k of Object.keys(__tbl)) {
          const __w = __tbl[__k];
          if (__w && Array.isArray(__w.sessionIds) && __w.sessionIds.includes(sessionId) && __w.path) { __c = String(__w.path); break; }
        }
      }
      if (!__c) {
        const __sid = sessionId.startsWith("session-") ? sessionId : ("session-" + sessionId);
        const __pc = join(__home, "storages", "session_projcache", "sessions", __sid + ".json");
        if (existsSync(__pc)) {
          const __jj = JSON.parse(readFileSync(__pc, "utf8"));
          const __p = __jj && __jj.record && __jj.record.identity && __jj.record.identity.cwd;
          if (__p) __c = String(__p);
        }
      }
      if (__c) cwd = __c;
      __pcCwdUsed = String(cwd || "");
    } catch (e) { __pcCwdUsed = "err:" + String(e && e.message ? e.message : e); }
    if (!__pcCtx || typeof __pcCtx.get !== "function") return "no-ctx";
    const sc = __pcCtx.get("sessionController");
    if (!sc) return "no-controller";
    const __tries = [];
    for (const nm of ["create", "resume", "createOrAdopt"]) {
      if (typeof sc[nm] === "function") __tries.push([nm, () => sc[nm]({ sessionId, cwd })]);
    }
    for (const face of ["typertRemote", "commands", "remote"]) {
      const fx = sc[face];
      if (fx && typeof fx === "object") {
        for (const nm of ["create", "resume"]) if (typeof fx[nm] === "function") __tries.push([face + "." + nm, () => fx[nm]({ sessionId, cwd })]);
      }
    }
    const ag = sc.agents;
    if (ag && typeof ag.ensureSession === "function") __tries.push(["agents.ensureSession", () => ag.ensureSession(sessionId, cwd, true)]);
    const __pcErrs = [];
    for (const [nm, fn] of __tries) {
      try { const r = await fn(); if (r !== void 0) return "ok:" + nm; } catch (e) { __pcErrs.push(nm + "=" + String(e && e.message ? e.message : e).slice(0, 90)); }
    }
    return "none(" + __tries.length + "): " + (__pcErrs.join(" | ") || "无异常但返回 undefined");
  } catch (e) { return "err:" + String(e && e.message ? e.message : e); }
}
async function __pcAwaitAgent(sessionId, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const a = ctxAgentsGet(sessionId); if (a && typeof a.followup === "function") return a; } catch (e) { /* ignore */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
function ctxAgentsGet(sessionId) {
  try {
    const sc = (__pcCtx && typeof __pcCtx.get === "function") ? __pcCtx.get("sessionController") : null;
    const cands = [__pcCtx && __pcCtx.agents, sc && sc.agents, __pcAgents()];
    for (const c of cands) if (c && typeof c.get === "function") { const a = c.get(sessionId); if (a) return a; }
  } catch (e) { /* ignore */ }
  return null;
}
// [local patch] followup 需要的是 createUserMessage(...) 产生的消息对象，传字符串只会建出空 turn
// （实测：prompt=""）。这里按原版 reportToSession 的同样构造生成消息。
function __pcBuildMsg(report) {
  try {
    return createUserMessage({
      content: [{ type: "text", text: "⏰ 每日投稿状态自动汇报（插件 投稿状态追踪）：\n\n" + report + "\n\n——请一句话确认收到即可，不要重新检查、不要调用工具。" }],
      source: { kind: "user" }
    });
  } catch (e) { return report; }
}
async function openLoginFrame(page, baseUrl, dbg, attempts = 3) {
	try {
		if (!page.__pcDiag) {
			page.__pcDiag = true;
			dbg.push("pwcore=" + (typeof pwRequire?.resolve === "function" ? pwRequire.resolve("playwright-core") : "?"));
			dbg.push("browser=" + ((page.context?.()?.browser?.()?.version?.()) ?? "?"));
			dbg.push("proxy=" + String(process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy ?? "(unset)"));
			page.on?.("requestfailed", (r) => { if (dbg.length < 20) dbg.push("reqfail=" + String(r.url()).slice(0, 70) + "::" + String((r.failure?.()?.errorText) ?? "")); });
			page.on?.("pageerror", (e) => { if (dbg.length < 20) dbg.push("pageerror=" + String(e?.message ?? e).slice(0, 90)); });
			page.on?.("console", (m) => { if (m?.type?.() === "error" && dbg.length < 20) dbg.push("consoleerr=" + String(m.text()).slice(0, 90)); });
		}
	} catch (e) { /* ignore */ }
	for (let a = 1; a <= attempts; a++) {
		try {
			await page.goto(`${baseUrl}/Default.aspx?pg=login.asp&username=`, { waitUntil: "domcontentloaded", timeout: 6e4 });
		} catch (e) {
			dbg.push("goto" + a + "=" + String(e).split("\n")[0]);
		}
		let f = await waitForFrame(page, 12e3);
		if (!f || !f.url() || f.url().includes("about:blank")) {
			const forced = await page.evaluate((u) => {
				const fr = document.querySelector('iframe[name="content"]');
				if (!fr) return "no-iframe";
				if (!fr.src || String(fr.src).includes("about:blank")) fr.src = u;
				return "src-set";
			}, `${baseUrl}/login.asp?username=`).catch((e) => "eval-failed:" + String(e?.message ?? e));
			dbg.push("try" + a + "=forceSrc:" + forced);
			f = await waitForFrame(page, 25e3);
		}
		const frames = page.frames().map((x) => (x.name() || "(main)") + ":" + (x.url() || "")).join(" , ");
		if (dbg.length < 20) dbg.push("try" + a + "=" + (f ? f.url() : "null") + " frames[" + frames.slice(0, 260) + "]");
		if (!f) continue;
		await f.waitForSelector("input[name='username']", { state: "attached", timeout: 2e4 }).catch(() => {});
		await f.evaluate(() => {
			const details = document.querySelector("#traditionalLoginCollapsible");
			if (details) details.open = true;
			const ud = document.querySelector("#userNamePasswordDiv");
			if (ud) ud.classList.remove("hideElement");
			const eb = document.querySelector("#emLoginButtonsDiv");
			if (eb) eb.classList.remove("hideElement");
		}).catch(() => {});
		await f.waitForSelector("input[name='username']", { state: "visible", timeout: 1e4 }).catch(() => {});
		const visible = await f.locator("input[name='username']").isVisible().catch(() => false);
		if (visible) return f;
		dbg.push("try" + a + "=usernameVisible:false");
		await page.waitForTimeout(1500);
	}
	return null;
}
async function waitForMainMenu(page) {
	for (let i = 0; i < 40; i++) {
		await page.waitForTimeout(1e3);
		const f = page.frame({ name: "content" });
		if (f && (f.url().includes("AuthorMainMenu") || f.url().includes("MainMenu"))) {
			if ((await f.evaluate(() => document.body ? document.body.innerText : "").catch(() => "")).includes("Submissions")) return f;
		}
	}
	return null;
}
async function scrapeMenu(frame) {
	const text = await frame.evaluate(() => document.body ? document.body.innerText : "").catch(() => "");
	const counts = {};
	for (const m of text.matchAll(/([^\n()]{2,60}?)\s*\((\d+)\)/g)) counts[m[1].trim()] = parseInt(m[2], 10);
	return {
		counts,
		links: await frame.evaluate(() => {
			const out = {};
			for (const a of document.querySelectorAll("a")) {
				const t = (a.innerText || "").trim();
				if (t && a.href) out[t] = a.href;
			}
			return out;
		}).catch(() => ({}))
	};
}
async function parseTable(frame) {
	for (let i = 0; i < 40; i++) {
		if (await frame.evaluate(() => {
			return !!(document.querySelector("table#datatable") || document.querySelector("table#GridSubmissions")) || Array.from(document.querySelectorAll("table")).some((tb) => tb.querySelector("th"));
		}).catch(() => false)) return frame.evaluate(() => {
			const table = document.querySelector("table#datatable") || document.querySelector("table#GridSubmissions") || Array.from(document.querySelectorAll("table")).find((tb) => tb.querySelector("th"));
			if (!table) return null;
			let ths = [];
			const theadThs = table.querySelectorAll("thead th");
			if (theadThs.length > 0) ths = Array.from(theadThs).map((th) => (th.innerText || "").replace(/\s+/g, " ").trim() || "action");
			else ths = Array.from(table.querySelectorAll("th")).map((th) => (th.innerText || "").replace(/\s+/g, " ").trim() || "action");
			const rows = Array.from(table.querySelectorAll("tbody tr, tr")).filter((tr) => tr.querySelector("td") && !tr.querySelector("th")).map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => (td.innerText || "").replace(/\s+/g, " ").trim()));
			return {
				headers: ths,
				rows
			};
		}).catch(() => null);
		await frame.waitForTimeout(500);
	}
	return null;
}
/**
* 遍历表格的所有分页（EM datatable 常见分页），最多 maxPages 页，合并返回全部行。
* 用于决策历史等可能跨页的分区；普通活跃分区（一般一页内）仍走 parseTable。
* 分页控件是 <a href="javascript:document.resort.currentpage.value=N;document.resort.submit();">Next</a>，
* 点击后 content iframe 整页导航（2-4s），故翻页后轮询等待第一行编号变化，避免导航中误判/断连。
*/
async function scrapeTableAllPages(frame, maxPages = 8) {
	let merged = null;
	let prevFirst = "";
	for (let p = 0; p < maxPages; p++) {
		let parsed = await parseTable(frame);
		if (!parsed || parsed.rows.length === 0) {
			let ok = false;
			for (let w = 0; w < 20 && !ok; w++) {
				await frame.waitForTimeout(500);
				parsed = await parseTable(frame);
				if (parsed && parsed.rows.length > 0) ok = true;
			}
			if (!ok) break;
		}
		if (!merged) merged = {
			headers: parsed.headers,
			rows: []
		};
		const first = parsed.rows[0]?.[1] ?? parsed.rows[0]?.[0] ?? "";
		if (p > 0 && first === prevFirst) break;
		merged.rows.push(...parsed.rows);
		prevFirst = first;
		if (!await frame.evaluate(() => {
			const n = Array.from(document.querySelectorAll("a, button, input[type=\"button\"]")).find((e) => {
				const t = (e.innerText ?? e.value ?? "").trim();
				return /^(next|›|»|&gt;|>)/i.test(t);
			});
			if (!n) return false;
			n.click();
			return true;
		}).catch(() => false)) break;
		let moved = false;
		for (let w = 0; w < 16; w++) {
			await frame.waitForTimeout(500);
			const cur = await frame.evaluate(() => {
				const t = document.querySelector("table#datatable") || document.querySelector("table#GridSubmissions") || Array.from(document.querySelectorAll("table")).find((tb) => tb.querySelector("th"));
				const tr = t ? Array.from(t.querySelectorAll("tbody tr, tr")).find((r) => r.querySelector("td") && !r.querySelector("th")) : null;
				if (!tr) return "";
				const tds = tr.querySelectorAll("td");
				return (tds[1]?.innerText || tds[0]?.innerText || "").trim();
			}).catch(() => "");
			if (cur && cur !== prevFirst) {
				moved = true;
				break;
			}
		}
		if (!moved) break;
	}
	return merged;
}
function normalizeRows(parsed) {
	if (!parsed) return [];
	return parsed.rows.map((cells) => {
		const rec = {};
		parsed.headers.forEach((h, i) => {
			rec[h.toLowerCase()] = cells[i] ?? "";
		});
		return {
			number: rec["manuscript number"] ?? "",
			title: rec["title"] ?? rec["article title"] ?? "",
			submitted: rec["initial date submitted"] ?? "",
			statusDate: rec["status date"] ?? rec["final decision date"] ?? rec["decision date"] ?? rec["transfer offer expiration date"] ?? "",
			revBegan: rec["date revision began"] ?? "",
			revDue: rec["date revision due"] ?? rec["transfer offer expiration date"] ?? "",
			status: rec["current status"] ?? rec["production status"] ?? rec["status"] ?? ""
		};
	}).filter((s) => s.number || s.title);
}
// ===== 持久化浏览器会话（B 方案）=====
// 目的：支持 ORCID / 学校 SSO / Taylor&Francis 等「没法用账号密码填表完成」的登录。
// 做法：Chromium 用固定 profile 目录启动（launchPersistentContext），人工在有头窗口里登录一次，
// cookie 落到 profile 里；之后所有无头抓取都复用这份登录态，不再走 Editorial Manager 表单。
const PC_LOGIN_TIMEOUT_MS = 600000;
/** 持久化 profile 目录（自动创建）。 */
function pcProfileDir() {
	const dir = join(homedir(), ".dsh", "manuscript-tracker", "browser-profile");
	try {
		mkdirSync(dir, { recursive: true });
	} catch {}
	return dir;
}
// 同一个 profile 不能被两个 Chromium 实例同时打开（Chromium 的 ProcessSingleton 会让后启动的那个直接失败），
// 所以浏览器会话串行化：定时检查 / 面板检查 / 登录一次 排队执行，而不是互相把 profile 锁死。
let __pcBrowserChain = Promise.resolve();
async function pcAcquireBrowser() {
	const prev = __pcBrowserChain;
	let releaseSlot = () => {};
	__pcBrowserChain = new Promise((r) => {
		releaseSlot = r;
	});
	await prev;
	let done = false;
	let guard = null;
	const release = () => {
		if (done) return;
		done = true;
		if (guard) clearTimeout(guard);
		try {
			releaseSlot();
		} catch {}
	};
	// 兜底：调用点若在异常路径漏关，20 分钟后自动放行，避免整条队列永久卡死
	guard = setTimeout(release, 1200000);
	try {
		guard.unref?.();
	} catch {}
	return release;
}
/** 清掉 Chromium 的单例锁文件（上个进程被强杀时残留，会让新实例启动失败）。 */
function pcClearSingleton(profileDir) {
	for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket", "lockfile"]) {
		try {
			const p = join(profileDir, f);
			if (existsSync(p)) rmSync(p, { force: true });
		} catch {}
	}
}
/** 启动 Playwright Chromium；browserPath 非空时用其中的 headless shell（版本号取自 playwright 期望值）。
 *  B 方案：改为在持久化 profile 里启动，返回 BrowserContext（自带 newPage()/close()，调用点可直接用）。
 *  启动失败（profile 被占 / 损坏）时清一次单例锁重试，再失败就退回临时 Browser ——
 *  保证「现有 EM 期刊照旧能抓」这条底线不被 profile 问题拖垮。 */
async function launchChromium(browserPath) {
	const { chromium } = pwRequire("playwright-core");
	const release = await pcAcquireBrowser();
	const opts = {
		headless: true,
		viewport: {
			width: 1440,
			height: 900
		},
		locale: "en-US"
	};
	if (browserPath) {
		const rev = chromium.executablePath().match(/chromium[_-]?(\d+)/)?.[1];
		if (rev) {
			const exe = join(browserPath, "chromium_headless_shell-" + rev, "chrome-win", "headless_shell.exe");
			if (existsSync(exe)) {
				process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
				opts.executablePath = exe;
			}
		}
	}
	const dir = pcProfileDir();
	let ctx = null;
	try {
		ctx = await chromium.launchPersistentContext(dir, opts);
	} catch (e1) {
		log(defaultReportDir(), "持久化 profile 启动失败: " + String(e1).split("\n")[0].slice(0, 300));
		if (/singleton|in use|already (running|open)|lock|EBUSY|EPERM/i.test(String(e1))) {
			pcClearSingleton(dir);
			await new Promise((r) => setTimeout(r, 1200));
			try {
				ctx = await chromium.launchPersistentContext(dir, opts);
			} catch (e2) {
				log(defaultReportDir(), "清锁后仍失败: " + String(e2).split("\n")[0].slice(0, 300));
			}
		}
	}
	if (ctx) {
		try {
			ctx.on("close", release);
		} catch {
			release();
		}
		return ctx;
	}
	// 回退：临时 Browser（不持久化 → 用不上登录态，但抓取不整体失败）
	try {
		const b = await chromium.launch({ headless: true });
		try {
			b.on("disconnected", release);
		} catch {
			release();
		}
		return b;
	} catch (e3) {
		release();
		throw e3;
	}
}
/** 统一取页面：持久化 context 启动时自带一个 about:blank 页，复用它；
 *  回退的 Browser 没有 newPage()，走 newContext()+newPage()。 */
async function openBrowserPage(browser) {
	if (browser && typeof browser.newPage === "function") {
		const pages = browser.pages?.() ?? [];
		const blank = pages.find((p) => {
			try {
				return p.url() === "about:blank";
			} catch {
				return false;
			}
		});
		return blank || browser.newPage();
	}
	const c = await browser.newContext({
		viewport: {
			width: 1440,
			height: 900
		},
		locale: "en-US"
	});
	return c.newPage();
}
/** 登录页特征：URL 里出现这些，就当「还在登录流程里」。 */
const PC_LOGIN_URL_RE = /(\/|\?)login|login\.aspx?|accounts\.|identity|\/signin|sign-in|\/auth|oauth|openid|sso|shibboleth/i;
/** 页面上（含各 iframe）是否还有登录表单：EM 的 username/authorLogin，或任意密码框。
 *  表单还在就一定没登录完 —— 这条比 URL 可靠（EM 登录页把密码框藏在 hideElement 里，
 *  所以只数 DOM 里存在，不看可见性）。 */
async function pcHasLoginForm(page) {
	const sel = "input[name='username'], input[name='authorLogin'], input[type='password']";
	const countIn = async (t) => {
		try {
			return await t.locator(sel).count() > 0;
		} catch {
			return false;
		}
	};
	if (await countIn(page)) return true;
	for (const f of page.frames?.() ?? []) if (await countIn(f)) return true;
	return false;
}
/** 取业务正文（优先 content iframe：EM 的主体内容在 iframe 里）。 */
async function pcBodyText(page) {
	const cf = page.frame?.({ name: "content" });
	const t1 = cf ? await cf.evaluate(() => document.body ? document.body.innerText : "").catch(() => "") : "";
	if (t1 && String(t1).trim()) return String(t1);
	return String(await page.evaluate(() => document.body ? document.body.innerText : "").catch(() => "") || "");
}
/** 判断某一页是否已经登录成功（「登录一次」轮询用）：没登录表单 + URL 不像登录页 + 正文有业务字样。 */
async function pcLoggedInSignal(page, startHost) {
	const url = String(page.url?.() ?? "");
	if (!url || url === "about:blank" || !/^https?:/i.test(url)) return {
		ok: false,
		url,
		why: "blank"
	};
	let host = "";
	try {
		host = new URL(url).hostname.toLowerCase();
	} catch {
		host = "";
	}
	if (await pcHasLoginForm(page)) return {
		ok: false,
		url,
		why: "login-form"
	};
	const leftHost = !!startHost && !!host && host !== startHost;
	if (!leftHost && PC_LOGIN_URL_RE.test(url)) return {
		ok: false,
		url,
		why: "login-url"
	};
	const txt = await pcBodyText(page);
	if (String(txt).trim().length < 40) return {
		ok: false,
		url,
		why: "thin-page"
	};
	if (!/(submission|manuscript|author|dashboard|profile|account|welcome|orcid|home|my )/i.test(txt)) return {
		ok: false,
		url,
		why: "no-biz-text"
	};
	return {
		ok: true,
		url,
		why: "ok"
	};
}
/** 有头浏览器可执行文件候选：先试配置里的浏览器目录（chromium-<rev> 完整包，不是 headless shell），
 *  再试 Playwright 默认安装，最后交给 playwright 自己解析。 */
function pcHeadedExeCandidates(browserPath) {
	const { chromium } = pwRequire("playwright-core");
	const out = [];
	const push = (p) => {
		if (p && existsSync(p) && !out.includes(p)) out.push(p);
	};
	try {
		const expected = chromium.executablePath();
		const rev = expected?.match(/chromium[_-]?(\d+)/)?.[1];
		if (browserPath && rev) {
			push(join(browserPath, "chromium-" + rev, "chrome-win", "chrome.exe"));
			push(join(browserPath, "chromium-" + rev, "chrome-win64", "chrome.exe"));
			process.env.PLAYWRIGHT_BROWSERS_PATH = browserPath;
		}
		push(expected);
	} catch {}
	out.push(void 0);
	return out;
}
/** [local patch 2026-10-22d] 网址是不是「登录 / 统一身份门户」页（这类页没有稿件列表，不能当期刊入口） */
function pcIsLoginishUrl(u) {
	const s0 = String(u || "").toLowerCase();
	if (!s0) return true;
	return /(orcid\.org|accounts\.taylorfrancis\.com|\/identity(\/|$|\?)|login\.microsoftonline|\/login(\/|$|\?)|\/signin|\/sign-in|\/oauth(\/|$|\?)|\/sso(\/|$|\?)|[?&]pg=login)/.test(s0);
}
/** [local patch 2026-10-22d] 从登录轨迹里挑出真正的投稿系统网址：命中已知投稿系统主机、且不是登录页的优先 */
function pcTraceBestUrl(entered, urls) {
	let inHost = "";
	try {
		inHost = new URL(String(entered || "")).hostname.toLowerCase();
	} catch {}
	let best = "";
	let bestScore = -1;
	for (const raw of urls || []) {
		const u = String(raw || "");
		if (!/^https?:\/\//i.test(u)) continue;
		if (pcIsLoginishUrl(u)) continue;
		let host = "";
		let path = "/";
		try {
			const o = new URL(u);
			host = o.hostname.toLowerCase();
			path = (o.pathname || "/").toLowerCase();
		} catch {
			continue;
		}
		let score = 10;
		if (/^rp\.tandfonline\.com$/.test(host)) score = /dashboard/.test(path) ? 120 : 100;
		else if (/editorialmanager\.com$/.test(host)) score = /(login\.asp|pg=login)/i.test(u) ? 20 : 110;
		else if (/manuscriptcentral\.com$/.test(host)) score = 105;
		else if (/^snapp|snapp\./.test(host)) score = 95;
		else if (/scholarone/.test(host)) score = 90;
		else if (host && host !== inHost) score = 30;
		if (score > bestScore) {
			bestScore = score;
			best = u;
		}
	}
	return bestScore >= 30 ? best : "";
}
/** [local patch 2026-10-22d] 把 plan 写到指定 baseUrl 名下（key 由 baseUrl 决定） */
function pcWriteStructureAt(baseUrl, plan) {
	try {
		const p = pcStructurePath(baseUrl);
		mkdirSync(pcStructuresDir(), {
			recursive: true
		});
		writeFileSync(p, JSON.stringify({
			baseUrl,
			plan,
			capturedAt: new Date().toISOString()
		}, null, 2), "utf8");
		return p;
	} catch (e) {
		return "";
	}
}
/** [patch 2026-10-22e] host service refs captured while the context is active (the timer context is inactive) */
let __pcSCRef = null;
let __pcAgentsRef = null;
let __pcSessionsRef = null;
let __pcLoginOnceBusy = false;
/** 人工登录一次：有头窗口打开期刊入口，等用户自己完成 ORCID / SSO / 表单登录。
 *  登录态（cookie）随 profile 落盘，之后的无头抓取直接复用。 */
async function loginOnce(baseUrl, browserPath, onLoggedIn) {
	const { chromium } = pwRequire("playwright-core");
	const startedAt = Date.now();
	const release = await pcAcquireBrowser();
	let ctx = null;
	const launchErr = [];
	try {
		const dir = pcProfileDir();
		for (const exe of pcHeadedExeCandidates(browserPath)) {
			const opts = {
				headless: false,
				viewport: {
					width: 1280,
					height: 860
				},
				locale: "en-US"
			};
			if (exe) opts.executablePath = exe;
			try {
				ctx = await chromium.launchPersistentContext(dir, opts);
				break;
			} catch (e) {
				launchErr.push((exe ? "exe=" + exe + " " : "default ") + String(e).split("\n")[0].slice(0, 200));
				if (/singleton|in use|already (running|open)|lock|EBUSY|EPERM/i.test(String(e))) {
					pcClearSingleton(dir);
					await new Promise((r) => setTimeout(r, 1200));
				}
			}
		}
		if (!ctx) return {
			ok: false,
			waitedMs: Date.now() - startedAt,
			error: "有头浏览器启动失败（没有可用的完整 Chromium）: " + launchErr.join(" | ").slice(0, 500)
		};
		const page = (ctx.pages?.() ?? [])[0] ?? await ctx.newPage();
		// [patch 2026-10-22k] 页面内记录器：用户每次输入/点击/回车都把账号密码记到 window.__pcCapturedCreds，
		// 这样即使 1 秒轮询刚好错过提交前一瞬也能读到（此前偶尔出现用户明明填了却 creds=no）。
		try {
			await ctx.addInitScript(() => {
				try {
					const grab = () => {
						try {
							const pws = Array.from(document.querySelectorAll("input[type=password]"));
							const pw = pws.find((i) => String(i.value || "").length > 0);
							if (!pw) return;
							const form = pw.form || (pw.closest ? pw.closest("form") : null) || document;
							const cands = Array.from(form.querySelectorAll("input")).filter((i) => {
								const ty = String(i.type || "").toLowerCase();
								if (ty !== "text" && ty !== "email" && ty !== "") return false;
								return i !== pw && String(i.value || "").length > 0;
							});
							const u = cands.find((i) => /user|email|login|account|name|id/i.test(String(i.name || "") + String(i.id || "") + String(i.placeholder || ""))) || cands[0];
							window.__pcCapturedCreds = { username: u ? String(u.value || "") : "", password: String(pw.value || "") };
								try { console.log("__pcCred__ " + JSON.stringify(window.__pcCapturedCreds)); } catch (e2) {}
						} catch (e) {}
					};
					for (const ev of ["input", "change", "blur", "submit", "click", "keydown"]) document.addEventListener(ev, grab, true);
					setInterval(grab, 500);
				} catch (e) {}
			});
		} catch (e) { log(defaultReportDir(), "登录追踪：安装凭据记录器失败 " + String(e).slice(0, 160)); }
		// [patch 2026-10-22k2] 记录器每次输入都会 console.log 一条带标记的凭据：即使页面随即跳走，
		// 也能通过 console 事件第一时间拿到（1 秒轮询来不及读页面状态的情况）。
		let __pcCreds = null;
		const __pcOnConsole = (m) => {
			try {
				const t = String(m?.text?.() ?? "");
				if (!t.startsWith("__pcCred__ ")) return;
				const j = JSON.parse(t.slice(11));
				if (j && j.password) __pcCreds = { username: String(j.username || ""), password: String(j.password) }; // [patch 2026-10-22k3]
			} catch {}
		};
		try {
			for (const pg of ctx.pages?.() ?? []) pg.on?.("console", __pcOnConsole);
			ctx.on?.("page", (pg) => pg.on?.("console", __pcOnConsole));
		} catch {}
		let startHost = "";
		try {
			startHost = new URL(baseUrl).hostname.toLowerCase();
		} catch {}
		await page.goto(baseUrl, {
			waitUntil: "domcontentloaded",
			timeout: 6e4
		}).catch(() => {});
		// [local patch 2026-10-22b] 全程追踪：从点「登录一次」到用户关闭浏览器窗口，记录访问过的每个页面；
		// 不再一检测到登录成功就关窗口（用户往往还要点进「我的稿件 / 作者中心」），每出现新页面就试一次结构识别，
		// 最后把整条访问轨迹 + 命中的 plan 一起报回面板。
		const TRACE_CAP_MS = 18e5;
		const TRACE = [];
		const traceSeen = new Set();
		const __pcTracePush = (u, t) => {
			const url = String(u ?? "");
			if (!url || traceSeen.has(url) || url === "about:blank") return;
			traceSeen.add(url);
			TRACE.push({ at: Math.round((Date.now() - startedAt) / 1000), url, title: String(t ?? "").slice(0, 120) });
		};
		let lastUrl = String(page.url?.() ?? "");
		let okUrl = "";
		let loggedIn = false;
		let browserClosed = false;
		let emptyTicks = 0;
		try {
			ctx.on?.("close", () => {
				browserClosed = true;
			});
		} catch {}
		let __pcCredsLocked = false; // [patch 2026-10-22i] 登录成功后冻结凭据
		let structure = null;
		let planAt = "";
		let attempts = 0;
		let lastTryAt = 0;
		let lastTryKey = "";
		let bestHint = "";
		const tryRecognize = async (why) => {
			if (structure && structure.plan) return;
			if (!onLoggedIn) return;
			if (attempts >= 8) return;
			attempts += 1;
			lastTryAt = Date.now();
			const pagesNow = (ctx.pages?.() ?? []).map((pg) => String(pg.url?.() ?? "")).filter((u) => u && u !== "about:blank");
			lastTryKey = pagesNow.slice().sort().join("\n");
			log(defaultReportDir(), "登录追踪识别 #" + attempts + "（" + why + "）pages=" + pagesNow.length);
			try {
				const rec = await onLoggedIn(ctx, pagesNow[0] || baseUrl, bestHint);
				if (rec && rec.plan) {
					structure = rec;
					planAt = String(rec.plan?.listUrl || "");
					log(defaultReportDir(), "登录追踪识别成功 #" + attempts + " system=" + String(rec.plan?.system ?? "") + " listUrl=" + planAt);
				} else if (rec && rec.error) {
					structure = rec;
				}
			} catch (e) {
				structure = { error: String(e) };
			}
		};
		while (Date.now() - startedAt < TRACE_CAP_MS) {
			await new Promise((r) => setTimeout(r, 1000));
			if (browserClosed) break;
			let pagesList = [];
			try {
				pagesList = ctx.pages?.() ?? [];
			} catch {
				browserClosed = true;
				break;
			}
			if (!pagesList.length) {
				emptyTicks += 1;
				log(defaultReportDir(), "登录追踪：当前没有可见标签页（第 " + emptyTicks + " 次），窗口还开着就继续等");
				if (emptyTicks >= 8) {
					browserClosed = true;
					break;
				}
				continue;
			}
			emptyTicks = 0;
			// 1) 顺手记下账号密码（登录表单还在页面上时取 value；提交后页面跳走就没了）
			// [patch 2026-10-22i] 不再「只记第一次」：用户可能第一次输错再重输，因此一直刷新直到登录成功才冻结
			// [patch 2026-10-22k3] 始终刷新：最后一次输入就是用户真正提交的那一份
			if (true) {
				for (const pg of pagesList) {
					for (const fr of pg.frames?.() ?? []) {
						try {
							const got = await fr.evaluate(() => {
								// [patch 2026-10-22k] 优先读页面内记录器抓到的「最后一次输入」
								const rec = window.__pcCapturedCreds;
								if (rec && rec.password) return { username: String(rec.username || ""), password: String(rec.password) };
								const pw = Array.from(document.querySelectorAll("input[type=password]")).find((i) => String(i.value || "").length > 0);
								if (!pw) return null;
								const form = pw.form || pw.closest?.("form") || document;
								const cands = Array.from(form.querySelectorAll("input")).filter((i) => {
									const ty = String(i.type || "").toLowerCase();
									if (ty !== "text" && ty !== "email" && ty !== "") return false;
									return i !== pw && String(i.value || "").length > 0;
								});
								const u = cands.find((i) => /user|email|login|account|name|id/i.test(String(i.name || "") + String(i.id || "") + String(i.placeholder || ""))) || cands[0];
								return { username: String(u?.value || ""), password: String(pw.value || "") };
							});
							if (got && got.password) __pcCreds = { username: got.username, password: got.password };
						} catch {}
					}
				}
			}
			// 2) 记录访问轨迹（新页面才取标题，避免每个 tick 都去查 title）
			for (const pg of pagesList) {
				try {
					const u = String(pg.url?.() ?? "");
					if (!u || traceSeen.has(u)) continue;
					let t = "";
					try {
						t = String(await Promise.race([pg.title(), new Promise((r) => setTimeout(() => r(""), 1200))]) ?? "");
					} catch {}
					__pcTracePush(u, t);
					lastUrl = u;
				} catch {}
			}
			// 3) 登录态信号（只用于标记"已登录"，不再据此关窗口）
			if (!loggedIn) {
				for (const pg of pagesList) {
					try {
						const sig = await pcLoggedInSignal(pg, startHost);
						if (sig.ok) {
							loggedIn = true;
							okUrl = sig.url;
							break;
						}
					} catch {}
				}
				if (loggedIn) log(defaultReportDir(), "登录追踪：检测到登录成功 url=" + okUrl);
			}
			// 4) 页面集合变了就试一次识别（不要求已登录：有些门户检测不到登录信号，用户点进稿件列表本身就是证据）
			if (!(structure && structure.plan) && Date.now() - lastTryAt > 1e4) {
				const cur = pagesList.map((pg) => String(pg.url?.() ?? "")).filter((u) => u && u !== "about:blank").sort().join("\n");
				if (cur && cur !== lastTryKey) await tryRecognize(loggedIn ? "页面变了" : "页面变了（还没检测到登录信号）");
			}
		}
		log(defaultReportDir(), "登录追踪结束：窗口" + (browserClosed ? "已关闭" : "到达 30 分钟上限") + "，用时 " + Math.round((Date.now() - startedAt) / 1000) + "s，访问页面 " + TRACE.length + " 条，loggedIn=" + loggedIn + " plan=" + !!(structure && structure.plan));
		// 收尾：补一次标题较全的轨迹快照
		try {
			for (const pg of ctx.pages?.() ?? []) {
				const u = String(pg.url?.() ?? "");
				if (!u || traceSeen.has(u)) continue;
				let t = "";
				try {
					t = String(await Promise.race([pg.title(), new Promise((r) => setTimeout(() => r(""), 1200))]) ?? "");
				} catch {}
				__pcTracePush(u, t);
			}
		} catch {}
		let bestUrl = pcTraceBestUrl(baseUrl, TRACE.map((x) => x.url));
		bestHint = bestUrl;
		if (!bestUrl && structure && structure.plan) {
			const lu0 = String(structure.plan.listUrl || "");
			if (lu0 && !pcIsLoginishUrl(lu0)) bestUrl = lu0;
		}
		if (bestUrl) log(defaultReportDir(), "登录追踪：轨迹里找到真实投稿系统网址 bestUrl=" + bestUrl);
		if (bestUrl && !(structure && structure.plan) && onLoggedIn && attempts < 8) {
			attempts += 1;
			log(defaultReportDir(), "登录追踪：按真实系统网址再识别一次 #" + attempts);
			try {
				const rec3 = await onLoggedIn(ctx, bestUrl, bestUrl);
				if (rec3 && rec3.plan) {
					structure = rec3;
					planAt = String(rec3.plan?.listUrl || "");
					log(defaultReportDir(), "登录追踪识别成功 #" + attempts + "（按 bestUrl）system=" + String(rec3.plan?.system ?? ""));
				} else if (rec3 && rec3.error && !(structure && structure.error)) structure = rec3;
			} catch (e) {
				log(defaultReportDir(), "登录追踪：按 bestUrl 识别异常 " + String(e).slice(0, 200));
			}
		}
		if (structure && structure.plan) {
			const lu1 = String(structure.plan.listUrl || "");
			if (bestUrl && (!lu1 || pcIsLoginishUrl(lu1))) {
				structure.plan.listUrl = bestUrl;
				planAt = bestUrl;
				log(defaultReportDir(), "登录追踪：plan.listUrl 指向登录页，改为真实系统网址 " + bestUrl);
			}
			if (bestUrl) {
				const w = pcWriteStructureAt(bestUrl, structure.plan);
				if (w) log(defaultReportDir(), "登录追踪：结构已按真实网址落盘 " + w);
			}
		}
		const plan = structure && structure.plan ? structure : null;
		if (!structure) structure = { error: "没有识别到可用的稿件列表" };
		if (!structure.plan) {
			if (!loggedIn) structure = { error: "等了 " + Math.round((Date.now() - startedAt) / 1000) + " 秒没检测到登录成功（登录态可能已存进 profile，可再点一次试试）" };
			else if (!structure.error) structure = { error: "登录成功，但在你访问过的页面里没认出击稿列表——请把面板下方轨迹里「我的稿件」那条网址直接填进上方再点一次" };
		}
		return {
			ok: loggedIn || !!plan,
			finalUrl: okUrl || lastUrl,
			waitedMs: Date.now() - startedAt,
			profileDir: dir,
			structure,
			planAt,
			closedByUser: browserClosed,
			bestUrl,
			pages: TRACE.slice(0, 60),
			creds: __pcCreds ?? void 0
		};
	} catch (e) {
		return {
			ok: false,
			waitedMs: Date.now() - startedAt,
			error: String(e)
		};
	} finally {
		try {
			await ctx?.close?.();
		} catch {}
		release();
	}
}

// ============ 第二步：登录后结构识别 + 通用抓取器（[local patch]） ============
const PC_SYSTEMS = ['editorial-manager', 'scholarone', 'taylorfrancis', 'sNAPP', 'other'];
const PC_SYSTEM_LABEL = {
    'editorial-manager': 'Editorial Manager',
    scholarone: 'ScholarOne',
    taylorfrancis: 'Taylor & Francis',
    sNAPP: 'sNAPP',
    other: '未知投稿系统',
};
function pcSystemLabel(s) { return PC_SYSTEM_LABEL[String(s ?? '')] || String(s ?? ''); }
/** 疑似投稿列表页的链接特征（主动打开 1-3 个候选页用）。 */
const PC_LIST_HINT_RE = /submissions?|manuscripts?|my submissions|author dashboard|dashboard|submission status/i;
function pcStructuresDir() {
    const dir = join(homedir(), '.dsh', 'manuscript-tracker', 'structures');
    try {
        mkdirSync(dir, { recursive: true });
    }
    catch { /* 静默 */ }
    return dir;
}
/** baseUrl → 稳定文件名（主机名 + 路径；非 [a-z0-9._-] 归一为 '_'）。 */
function pcStructureKey(baseUrl) {
    let raw = String(baseUrl ?? '');
    try {
        const u = new URL(raw);
        raw = u.hostname + (u.pathname && u.pathname !== '/' ? u.pathname : '');
    }
    catch { /* 不是 URL 就按原串处理 */ }
    const key = raw.toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return (key || 'site').slice(0, 120);
}
function pcStructurePath(baseUrl) { return join(pcStructuresDir(), pcStructureKey(baseUrl) + '.json'); }
/** 读结构 plan；没有文件返回 {path}（表示没有 plan），文件坏掉返回 {path,error}。 */
function pcReadStructure(baseUrl) {
    const p = pcStructurePath(baseUrl);
    if (!existsSync(p))
        return { path: p };
    try {
        const obj = JSON.parse(readFileSync(p, 'utf8'));
        if (!obj?.plan || typeof obj.plan !== 'object')
            return { path: p, error: '结构文件里没有 plan' };
        return { path: p, plan: obj.plan };
    }
    catch (e) {
        return { path: p, error: '结构文件解析失败: ' + String(e) };
    }
}
function pcStr(v, max = 300) {
    return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}
/** 清洗 LLM 返回的 plan：system 白名单、listUrl 必须是 http(s)、confidence 夹到 0..1。 */
function pcSanitizePlan(raw, _fallbackUrl) {
    const sysRaw = pcStr(raw?.system, 40).toLowerCase();
    const system = PC_SYSTEMS.find((s) => s.toLowerCase() === sysRaw) || 'other';
    let listUrl = pcStr(raw?.listUrl, 1000);
    if (!/^https?:\/\//i.test(listUrl))
        listUrl = '';
    const fields = {};
    for (const k of ['number', 'title', 'status', 'submitted', 'updated']) {
        const v = pcStr(raw?.fields?.[k], 200);
        if (v)
            fields[k] = v;
    }
    const menuSections = Array.isArray(raw?.menuSections)
        ? raw.menuSections.map((x) => pcStr(x, 80)).filter(Boolean).slice(0, 30)
        : [];
    let confidence = Number(raw?.confidence);
    if (!Number.isFinite(confidence))
        confidence = 0;
    confidence = Math.max(0, Math.min(1, confidence));
    return {
        system,
        listUrl,
        rowSelector: pcStr(raw?.rowSelector, 300),
        fields,
        menuSections,
        confidence,
        notes: pcStr(raw?.notes, 800),
    };
}
/** 结构识别用的 LLM 提示词：只准输出 JSON，判据写死，避免模型自由发挥。 */
function pcStructurePrompt(baseUrl, journalName, digest, emHint) {
    return [
        '你是网页结构分析器。下面是用户**已经登录**的期刊投稿系统若干页面的结构摘要',
        '（每个页面的 URL + title + h1-h3 + 每张表的表头与前几行 + 按钮/链接文本 + 表单字段名）。',
        '请判断这是哪个投稿系统，并给出「投稿列表页」与抓取选择器建议。只输出 JSON，不要解释、不要 Markdown 代码块。',
        '',
        'system 取值与判据：',
        '- editorial-manager：URL 含 editorialmanager.com，页面有 Author Main Menu / Submissions Being Processed，',
        '  表格列为 Manuscript Number / Article Title / Initial Date Submitted / Status Date / Current Status。',
        '- scholarone：URL 含 mc.manuscriptcentral.com 或 scholarone，页面有 Author Dashboard / Submitted Manuscripts。',
        '- taylorfrancis：URL 含 tandfonline.com，或页面有 Author Services / Track my article。',
        '- sNAPP：URL 含 snapp，或页面有 sNAPP / Springer Nature 投稿界面。',
        '- other：以上都不像。',
        '',
        '输出格式（严格 JSON，不要多余字段）：',
        '{"system":"editorial-manager|scholarone|taylorfrancis|sNAPP|other",',
        ' "listUrl":"列表页完整 URL（必须来自摘要里出现过的 URL；没有就给空串）",',
        ' "rowSelector":"一行稿件对应的 CSS 选择器（不确定就给空串）",',
        ' "fields":{"number":"稿号选择器或列名","title":"标题","status":"状态","submitted":"初始投稿日期","updated":"状态更新日期"},',
        ' "menuSections":["页面上出现的分区名称"],',
        ' "confidence":0 到 1 之间的小数,',
        ' "notes":"一句话说明依据"}',
        '',
        'baseUrl: ' + baseUrl,
        'journalName: ' + (journalName || '(未提供)'),
        '页面特征提示: ' + (emHint
            ? '已检测到 Editorial Manager 特征（Author Main Menu / Submissions Being Processed）'
            : '未检测到 Editorial Manager 特征'),
        '',
        '=== 页面结构摘要开始 ===',
        digest,
        '=== 页面结构摘要结束 ===',
    ].join('\n');
}
/** 单页（含所有 iframe）摘要：title、h1/h2/h3、表格 + 前 3 行、按钮/链接文本（去重后最多 120 条）、表单字段名。 */
async function pcPageDigest(pg) {
    const out = [];
    const lists = [];
    let frames = [];
    try {
        frames = pg.frames?.() ?? [];
    }
    catch { /* 静默 */ }
    if (!frames.length)
        frames = [pg];
    for (const fr of frames) {
        let d = null;
        try {
            d = await fr.evaluate(() => {
                const txt = (el) => ((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
                const q = (sel) => Array.from(document.querySelectorAll(sel));
                const tables = q('table').slice(0, 6).map((tb) => {
                    const rows = Array.from(tb.querySelectorAll('tr')).slice(0, 4);
                    return rows
                        .map((r) => Array.from(r.querySelectorAll('th,td')).map(txt).filter(Boolean).slice(0, 12).join(' | '))
                        .filter(Boolean);
                }).filter((t) => t.length > 0);
                const ctrls = Array.from(new Set(q('a,button,input[type=button],input[type=submit]')
                    .map((e) => (txt(e) || e.value || '').trim())
                    .filter((t) => t && t.length <= 80))).slice(0, 120);
                const fields = q('input,select,textarea').map((e) => e.getAttribute('name') || e.id || '').filter(Boolean).slice(0, 60);
                const lists = Array.from(new Set(q('a[href]').map((a) => String(a.href || ''))
                    .filter((h) => /submissions?|manuscripts?|my submissions|author dashboard|dashboard|submission status/i.test(h)))).slice(0, 30);
                return { title: document.title || '', heads: q('h1,h2,h3').map(txt).filter(Boolean).slice(0, 12), tables, ctrls, fields, lists };
            });
        }
        catch {
            continue;
        }
        if (!d)
            continue;
        const chunk = [];
        if (d.title)
            chunk.push('title: ' + d.title);
        if (d.heads?.length)
            chunk.push('heads: ' + d.heads.join(' / '));
        if (d.tables?.length)
            d.tables.forEach((t, i) => chunk.push('table' + (i + 1) + ': ' + t.join(' ;; ')));
        if (d.ctrls?.length)
            chunk.push('controls: ' + d.ctrls.join(' | '));
        if (d.fields?.length)
            chunk.push('formFields: ' + d.fields.join(','));
        if (chunk.length)
            out.push(chunk.join('\n'));
        for (const u of (d.lists ?? []))
            if (!lists.includes(u))
                lists.push(u);
    }
    return { text: out.join('\n\n'), lists };
}
/** 收集 context 内所有页面的摘要，再主动打开 1-3 个疑似投稿列表页补采（登录态下才有内容）。 */
async function pcCollectStructureDigest(baseUrl, ctxAny) {
    const chunks = [];
    const seen = [];
    const cands = [];
    const pages = (() => { try {
        return ctxAny?.pages?.() ?? [];
    }
    catch {
        return [];
    } })();
    for (const pg of pages) {
        let u = '';
        try {
            u = String(pg.url?.() ?? '');
        }
        catch { /* 静默 */ }
        if (!u || u === 'about:blank' || seen.includes(u))
            continue;
        seen.push(u);
        const d = await pcPageDigest(pg);
        chunks.push('### page: ' + u + '\n' + d.text);
        for (const l of d.lists)
            if (!cands.includes(l))
                cands.push(l);
    }
    const picked = cands.filter((u) => !seen.includes(u) && PC_LIST_HINT_RE.test(u)).slice(0, 3);
    for (const u of picked) {
        let pg = null;
        try {
            pg = await ctxAny.newPage();
        }
        catch {
            break;
        }
        try {
            await pg.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await new Promise((r) => setTimeout(r, 1500)); // SPA 落地后再取 DOM
            const d = await pcPageDigest(pg);
            chunks.push('### page: ' + u + '  (list candidate)\n' + d.text);
        }
        catch {
            chunks.push('### page: ' + u + '  (list candidate, 打开失败)');
        }
        finally {
            try {
                await pg.close?.();
            }
            catch { /* 静默 */ }
        }
    }
    return { text: chunks.join('\n\n'), pages: [...seen, ...picked] };
}
/** EM 的硬特征（主菜单 frame / 表格文案）：LLM 挂了也能保证 EM 期刊不被误判成 other。 */
async function pcEmHint(ctxAny) {
    const pages = (() => { try {
        return ctxAny?.pages?.() ?? [];
    }
    catch {
        return [];
    } })();
    // 域名硬特征：editorialmanager.com 只服务 Editorial Manager（比页面文案更可靠，且不受 iframe 时序影响）。
    try {
        const urls = pages.map((pg) => String(pg?.url?.() ?? '')).join(' ');
        if (/editorialmanager\.com/i.test(urls))
            return true;
    }
    catch { /* 静默 */ }
    for (const pg of pages) {
        let frames = [];
        try {
            frames = pg.frames?.() ?? [];
        }
        catch { /* 静默 */ }
        for (const fr of frames) {
            const u = String(fr.url?.() ?? '');
            if (/AuthorMainMenu|MainMenu/i.test(u))
                return true;
            try {
                const head = await fr.evaluate(() => String((document.body && document.body.innerText) || '').slice(0, 1200));
                if (/submissions being processed|submit new manuscript/i.test(String(head)))
                    return true;
            }
            catch { /* 静默 */ }
        }
    }
    return false;
}
/** 识别 + 落盘。返回 {plan, planPath} 或 {error}（失败时绝不写假 plan）。 */
async function pcRecognizeStructure(opts) {
    const baseUrl = String(opts.baseUrl);
    try {
        const emHint = await pcEmHint(opts.ctxAny);
        const dig = await pcCollectStructureDigest(baseUrl, opts.ctxAny);
        if (!dig.text.trim())
            return { error: '登录成功，但页面上没取到可识别的结构（可能是纯前端空壳或整页 iframe 受限）。' };
        const digest = dig.text.length > 60000 ? dig.text.slice(0, 60000) + '\n…（摘要已截断）' : dig.text;
        let plan;
        let llmErr = '';
        const provider = opts.providerOverride || 'deepseek-official';
        const model = opts.modelOverride || (opts.providerOverride ? '' : 'deepseek-v4-pro');
        try {
            const raw = await callLlmText(opts.llmService, opts.settingsService, pcStructurePrompt(baseUrl, opts.journalName ?? '', digest, emHint), opts.providerOverride, opts.modelOverride);
            const m = String(raw).match(/\{[\s\S]*\}/);
            if (!m)
                throw new Error('模型没有返回 JSON: ' + String(raw).slice(0, 200));
            plan = pcSanitizePlan(JSON.parse(m[0]), baseUrl);
        }
        catch (e) {
            llmErr = String(e).split('\n')[0];
        }
        // EM 特征很硬：即便 LLM 挂了/判错，也按 editorial-manager 记一条高置信 plan（单刊抓取不受影响）。
        if (emHint) {
            const wantUrl = /AuthorMainMenu|MainMenu/i.test(String(plan?.listUrl ?? ''))
                ? plan.listUrl
                : baseUrl + '/Default.aspx?pg=authorMainMenu';
            plan = pcSanitizePlan({
                ...(plan ?? {}),
                system: 'editorial-manager',
                confidence: Math.max(plan?.confidence ?? 0, 0.95),
                listUrl: wantUrl,
                notes: ((plan?.notes ? plan.notes + '；' : '') + '检测到 EM 主菜单/域名特征，按 Editorial Manager 处理'),
            }, baseUrl);
        }
        if (!plan)
            return { error: '结构识别失败: ' + (llmErr || ('模型返回为空（' + provider + (model ? ' / ' + model : '') + '），可在配置页换一个识别模型再试')) };
        // [patch 2026-10-23a] 登录页/门户页上识别出来的结构不可信（没有行选择器/关键字段，或页面本身还在登录流程里），不落盘
        {
            const digPages = String(JSON.stringify(dig?.pages ?? ''));
            const looksLogin = pcIsLoginishPlan(plan) || PC_LOGIN_URL_RE.test(String(plan.listUrl ?? '')) ||
                /accounts\.taylorfrancis\.com|\/identity|orcid\.org\/signin/i.test(digPages);
            if (looksLogin && !emHint) {
                return { error: '这次识别是在登录页上做的（页面还在登录流程里），结构不可信、已丢弃。请点「登录一次」完成 ORCID/SSO 登录并打开稿件列表页，再点一次识别。' };
            }
        }
        const planPath = pcStructurePath(baseUrl);
        writeFileSync(planPath, JSON.stringify({
            baseUrl,
            journalName: opts.journalName ?? '',
            capturedAt: new Date().toISOString(),
            model: provider + '/' + (model || '(默认)'),
            pages: dig.pages,
            plan,
        }, null, 2), 'utf8');
        return { plan, planPath };
    }
    catch (e) {
        return { error: '结构识别异常: ' + String(e) };
    }
}
function pcNormDate(v) {
    const s = pcStr(v, 60);
    return s;
}
/** DOM 提取：按 plan 的 rowSelector / 字段选择器抓行；选择器为空或没命中返回 []（由调用方回退 LLM）。 */
async function pcExtractByPlan(pg, plan) {
    const rowSel = String(plan.rowSelector || '').trim();
    if (!rowSel)
        return [];
    let rows = [];
    try {
        rows = await pg.evaluate((arg) => {
            const txt = (el) => ((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
            const pick = (root, sel) => {
                if (!sel)
                    return '';
                try {
                    return txt(root.querySelector(sel));
                }
                catch {
                    return '';
                }
            };
            const out = [];
            for (const r of Array.from(document.querySelectorAll(arg.row)).slice(0, 200)) {
                const one = {};
                for (const k of Object.keys(arg.fields || {}))
                    one[k] = pick(r, String(arg.fields[k] || ''));
                out.push(one);
            }
            return out;
        }, { row: rowSel, fields: plan.fields ?? {} });
    }
    catch {
        return [];
    }
    const subs = [];
    for (const r of rows) {
        const number = pcStr(r?.number, 120);
        const title = pcStr(r?.title, 500);
        if (!number && !title)
            continue;
        subs.push({
            number: number || '(未识别稿号)',
            title: title || '(未识别标题)',
            submitted: pcNormDate(r?.submitted),
            statusDate: pcNormDate(r?.updated),
            status: pcStr(r?.status, 200) || '未知状态',
        });
    }
    return subs;
}
/** 回退：列表页可见文本（≤40KB）交给 LLM 抽 JSON 数组。 */
async function pcExtractByLlm(pg, plan, opts) {
    let body = '';
    try {
        body = String(await pg.evaluate(() => String((document.body && document.body.innerText) || '')));
    }
    catch { /* 静默 */ }
    body = body.trim();
    if (!body)
        return [];
    if (body.length > 40000)
        body = body.slice(0, 40000) + '\n…（正文已截断）';
    const prompt = [
        '下面是一个学术期刊投稿系统的「投稿列表页」纯文本（用户已登录' + (opts.journalName || '') + '）：',
        '请把页面上的每一篇稿件抽成 JSON 数组，只输出数组本身（不要解释、不要 Markdown 代码块）。',
        '[{"number":"稿号","title":"标题","status":"当前状态","submitted":"初始投稿日期","updated":"状态更新日期"}]',
        '要求：没有的字段给空串；不要编造页面上不存在的稿件；一篇文章一行；最多 200 条。',
        '识别到的系统类型提示: ' + plan.system,
        '',
        '=== 页面文本开始 ===',
        body,
        '=== 页面文本结束 ===',
    ].join('\n');
    const raw = await callLlmText(opts.llmService, opts.settingsService, prompt, opts.providerOverride, opts.modelOverride);
    const text = String(raw);
    let arr = null;
    const mArr = text.match(/\[[\s\S]*\]/);
    const mObj = text.match(/\{[\s\S]*\}/);
    try {
        if (mArr)
            arr = JSON.parse(mArr[0]);
        else if (mObj) {
            const o = JSON.parse(mObj[0]);
            arr = Array.isArray(o?.items) ? o.items : Array.isArray(o?.submissions) ? o.submissions : null;
        }
    }
    catch {
        arr = null;
    }
    if (!Array.isArray(arr))
        return [];
    const subs = [];
    for (const r of arr.slice(0, 200)) {
        const number = pcStr(r?.number, 120);
        const title = pcStr(r?.title, 500);
        if (!number && !title)
            continue;
        subs.push({
            number: number || '(未识别稿号)',
            title: title || '(未识别标题)',
            submitted: pcNormDate(r?.submitted),
            statusDate: pcNormDate(r?.updated),
            status: pcStr(r?.status, 200) || '未知状态',
        });
    }
    return subs;
}
/** 通用抓取器：非 EM 系统走这里（DOM 优先，0 条回退 LLM），status 里带上识别到的系统名。 */
/** 等列表行出现：命中即返回 true；超时返回 false（不抛）。 */
async function pg0WaitRows(page, sel, ms) {
    try {
        await page.waitForSelector(sel, { timeout: ms });
        return true;
    }
    catch {
        return false;
    }
}
/** [patch 2026-10-23b] plan 是否只是登录页的产物（没有行选择器/关键字段就不可信）。 */
function pcIsLoginishPlan(plan) {
    const rowSel = String(plan?.rowSelector ?? '').trim();
    const f = plan?.fields ?? {};
    return !rowSel || !String(f.number ?? '').trim() || !String(f.title ?? '').trim();
}
/** [patch 2026-10-23b] 页面现在是「登录页」还是「已登录的列表页」。goto 之后前端可能还在跳转，所以必须轮询。 */
async function pcListState(page, ms) {
    const end = Date.now() + Math.max(1000, ms || 12000);
    let lastUrl = '';
    while (Date.now() < end) {
        lastUrl = String(page.url?.() ?? '');
        let cards = -1;
        try {
            cards = await page.evaluate(() => document.querySelectorAll('div.submission.card').length);
        } catch { /* 页面跳转中，忽略 */ }
        if (cards > 0) return { state: 'rows', cards, url: lastUrl };
        const hasPw = await page.locator("input[type='password']").count().catch(() => 0);
        if (hasPw > 0) return { state: 'login', cards: 0, url: lastUrl };
        if (/accounts\.taylorfrancis\.com\/identity|orcid\.org\/signin|\/login|login\.aspx?|\/signin/i.test(lastUrl)) return { state: 'login', cards: 0, url: lastUrl };
        await new Promise((r) => setTimeout(r, 800));
    }
    return { state: 'unknown', cards: 0, url: lastUrl };
}
/** [patch 2026-10-23b] 抓取时被重定向到登录页 → 用期刊条目里记录的账号密码自动重登一次。
 *  覆盖：① Taylor & Francis 统一身份门户（#orcidBtn）→ orcid.org 填 ORCID 账号密码；② 通用邮箱/密码表单。 */
async function pcAutoRelogin(ctx, page, originUrl, j) {
    const errOf = (e) => String((e && e.message) || e).split('\n')[0].slice(0, 200);
    const user = String(j?.username ?? '').trim();
    const pass = String(j?.password ?? '');
    const looksOrcid = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(user);
    const pagesOf = () => (ctx && typeof ctx.pages === 'function' ? ctx.pages() : [page]);
    const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
    const backPoll = async (ms) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            for (const p of pagesOf()) {
                const u = String(p.url?.() ?? '');
                if (hostOf(u) === hostOf(originUrl)) {
                    const cards = await p.evaluate(() => document.querySelectorAll('div.submission.card').length).catch(() => 0);
                    const hasPw = await p.locator("input[type='password']").count().catch(() => 0);
                    if (cards > 0 || hasPw === 0) return { ok: true, page: p };
                }
            }
            await new Promise((r) => setTimeout(r, 800));
        }
        return { ok: false };
    };
    if (!user || !pass) return { ok: false, error: '期刊条目里没有保存账号密码' };

    // ① T&F 统一身份 → ORCID
    const orcidBtn = await page.$('#orcidBtn').catch(() => null);
    if (orcidBtn && looksOrcid) {
        try {
            await orcidBtn.click();
        } catch (e) {
            return { ok: false, error: '点「Login with ORCID」失败：' + errOf(e) };
        }
        let target = page;
        for (let i = 0; i < 40; i++) {
            await new Promise((r) => setTimeout(r, 500));
            const hit = pagesOf().find((p) => { try { return /orcid\.org\/signin/i.test(p.url()); } catch { return false; } });
            if (hit) { target = hit; break; }
            if (/orcid\.org\/signin/i.test(String(page.url?.() ?? ''))) break;
        }
        try {
            await target.waitForSelector('#username-input', { timeout: 25000 });
            await target.fill('#username-input', user);
            await target.fill('#password', pass);
            await target.click('#signin-button');
        } catch (e) {
            return { ok: false, error: 'ORCID 表单填写/提交失败：' + errOf(e) };
        }
        const back = await backPoll(60000);
        if (back.ok) return { ok: true, via: 'orcid', page: back.page };
        return { ok: false, error: 'ORCID 已提交，但 60s 内没回到已登录的投稿系统页面' };
    }

    // ② 通用账号密码表单
    try {
        const pwSel = (await page.$('#inputPassword')) ? '#inputPassword' : "input[type='password']";
        if (!(await page.$(pwSel))) return { ok: false, error: '登录页上没有密码输入框（也没有 ORCID 按钮）' };
        const emailSel = (await page.$('#inputEmail')) ? '#inputEmail' : "input[name='username'], input[name='email'], input[type='email']";
        await page.fill(emailSel, user).catch(() => {});
        await page.fill(pwSel, pass).catch(() => {});
        const btn = (await page.$('#loginBtn')) || (await page.$("button[type='submit'], input[type='submit']"));
        if (btn) await btn.click().catch(() => {});
        const back = await backPoll(45000);
        if (back.ok) return { ok: true, via: 'password', page: back.page };
        return { ok: false, error: '账号密码已提交，但 45s 内没回到已登录的投稿系统页面' };
    } catch (e) {
        return { ok: false, error: '账号密码自动登录失败：' + errOf(e) };
    }
}
async function scrapeGenericJournal(j, plan, opts) {
    const baseUrl = String(j.baseUrl);
    const system = String(plan?.system || 'other');
    // system 落到 'other' 时用更中性的标签，避免报告里出现「（未知投稿系统）」
    const sysLabel = system === 'other' ? '通用抓取' : pcSystemLabel(system);
    const listUrl = String(plan?.listUrl || '').trim();
    const planPath = pcStructurePath(baseUrl);
    if (!/^https?:\/\//i.test(listUrl)) {
        return {
            journal: j.name, system,
            error: sysLabel + '：结构识别结果里没有可用的投稿列表页（' + planPath + '），请重新点一次「登录一次」。',
        };
    }
    let browser = null;
    try {
        browser = await launchChromium(opts.browserPath);
        const page = await openBrowserPage(browser);
        try {
            await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        }
        catch (e) {
            return {
                journal: j.name, system,
                error: sysLabel + '：打开列表页失败（' + listUrl + '）：' + String(e).split('\n')[0].slice(0, 240) +
                    '；已复用登录态：' + pcProfileDir() + '（如过期请再点一次「登录一次」）',
            };
        }
        // [patch 2026-10-23b] 先看页面是「列表行」还是「登录页」（goto 后前端可能还在跳转，必须轮询）
        let listState = await pcListState(page, 14000);
        if (listState.state === 'login') {
            const rl = await pcAutoRelogin(browser, page, listUrl, j);
            if (!rl.ok) {
                return {
                    journal: j.name, system,
                    error: sysLabel + '：登录态已过期（' + listUrl + ' 被重定向到登录页），自动重新登录失败：' + String(rl.error || '未知原因') +
                        '；请点一次「登录一次」重新登录后再检查。',
                };
            }
            try {
                await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch { /* 交给后面的等待逻辑 */ }
            listState = await pcListState(page, 20000);
            if (listState.state === 'login') {
                return {
                    journal: j.name, system,
                    error: sysLabel + '：已用记录的账号密码重新登录，但仍被重定向到登录页（' + String(listState.url).slice(0, 160) +
                        '）；请点一次「登录一次」重新登录。',
                };
            }
        }
        if (false) {
            const rl = await pcAutoRelogin(browser, page, listUrl, j);
            if (!rl.ok) {
                return {
                    journal: j.name, system,
                    error: sysLabel + '：登录态已过期（' + listUrl + ' 被重定向到登录页），自动重新登录失败：' + String(rl.error || '未知原因') +
                        '；请点一次「登录一次」重新登录后再检查。',
                };
            }
            try {
                await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch { /* 交给后面的等待逻辑 */ }
            if (PC_LOGIN_URL_RE.test(String(page.url()))) {
                return {
                    journal: j.name, system,
                    error: sysLabel + '：已用记录的账号密码重新登录，但仍被重定向到登录页（' + String(page.url()).slice(0, 160) +
                        '）；请点一次「登录一次」重新登录。',
                };
            }
        }
        // [local patch 2026-10-22d] 等列表真正渲染出来（很多投稿系统是前端框架，domcontentloaded 时行还没出来）
        try {
            const rowSel0 = String(plan?.rowSelector || "").trim();
            if (rowSel0) await pg0WaitRows(page, rowSel0, 20000);
            else await new Promise((r) => setTimeout(r, 3000));
        }
        catch {
            await new Promise((r) => setTimeout(r, 2500));
        }
        let subs = [];
        let how = 'DOM 选择器';
        try {
            subs = await pcExtractByPlan(page, plan);
        }
        catch { /* 静默 */ }
        if (!subs.length) {
            how = 'LLM 文本抽取';
            try {
                subs = await pcExtractByLlm(page, plan, {
                    journalName: j.name,
                    llmService: opts.llmService,
                    settingsService: opts.settingsService,
                    providerOverride: opts.providerOverride,
                    modelOverride: opts.modelOverride,
                });
            }
            catch (e) {
                return {
                    journal: j.name, system,
                    error: sysLabel + '：DOM 和 LLM 都没抓到稿件（' + listUrl + '）：' + String(e).split('\n')[0].slice(0, 240) +
                        '；已复用登录态：' + pcProfileDir(),
                };
            }
        }
        if (!subs.length) {
            return {
                journal: j.name, system,
                error: sysLabel + '：列表页 ' + listUrl + ' 上没有解析到稿件（可能确实 0 条，也可能页面结构与识别结果不符）；已复用登录态：' + pcProfileDir() +
                    '；可重新点「登录一次」刷新结构（' + planPath + '）。',
            };
        }
        // status 末尾附系统名，报告里一眼看出这条来自哪个系统。
        const tagged = subs.map((s) => ({
            ...s,
            status: [s.status, sysLabel ? '（' + sysLabel + '）' : ''].join(''),
        }));
        const sectionName = (plan.menuSections && plan.menuSections[0]) ? plan.menuSections[0] : sysLabel + ' 投稿列表';
        return {
            journal: j.name,
            system,
            sections: [{ name: sectionName, count: tagged.length, submissions: tagged }],
        };
    }
    catch (e) {
        return {
            journal: j.name, system,
            error: sysLabel + '：通用抓取异常（' + listUrl + '）：' + String(e).split('\n')[0].slice(0, 240),
        };
    }
    finally {
        try {
            await browser?.close?.();
        }
        catch { /* 静默 */ }
    }
}
/** 抓取分流：有结构 plan 且不是 EM → 通用抓取器；EM / 没有 plan → 走 EM 逻辑（行为不变）。
 *  system='other' 的期刊：以前一律回退信号，现在只要登录后识别出了非 EM 系统就真的去抓（没有 plan 时行为不变）。 */
async function scrapeJournal(j, browserPath, env) {
    const st = pcReadStructure(j.baseUrl);
    const plan = st.plan;
    const e = env ?? {};
    // [patch 2026-10-22h] 非 editorial-manager 的系统（taylorfrancis / scholarone / sNAPP …）走通用抓取器
    const sys0 = String(j.system ?? 'editorial-manager');
    if (sys0 !== 'editorial-manager') {
        if (plan && plan.system !== 'editorial-manager')
            return scrapeGenericJournal(j, plan, { browserPath, ...e });
        return { journal: j.name, system: sys0 };
    }
    if (!plan || plan.system === 'editorial-manager')
        return scrapeEmJournal(j, browserPath);
    return scrapeGenericJournal(j, plan, { browserPath, ...e });
}
/** 抓取前先探一下持久化 profile 里有没有有效会话：有就直接进业务页，不走 EM 表单登录。
 *  kind='em' 复用主菜单 frame；kind='authed-other' 说明登录态有了但站点不是 EM；kind='none' 走原流程。 */
async function pcDetectSession(page, baseUrl, dbg) {
	try {
		await page.goto(baseUrl, {
			waitUntil: "domcontentloaded",
			timeout: 6e4
		});
	} catch (e) {
		dbg.push("probeGoto=" + String(e).split("\n")[0]);
		return { kind: "none" };
	}
	for (let i = 0; i < 14; i++) {
		const f = page.frame({ name: "content" });
		const fu = f ? String(f.url?.() ?? "") : "";
		const cfSettled = !!(f && fu && !fu.includes("about:blank"));
		if (f && /AuthorMainMenu|MainMenu/i.test(fu)) {
			const txt = await f.evaluate(() => document.body ? document.body.innerText : "").catch(() => "");
			if (/submission/i.test(String(txt))) {
				dbg.push("probe=em-reuse");
				return {
					kind: "em",
					frame: f
				};
			}
		}
		// 页面上还挂着登录表单 → 肯定没登录，直接走原 EM 表单流程（不必再空等）
		if (await pcHasLoginForm(page)) {
			dbg.push("probe=login-form");
			return { kind: "none" };
		}
		// 没有任何登录表单 + 正文有业务字样 → 已登录但非 EM（例如 Taylor&Francis 作者中心）
		// 注意：EM 新版外壳页（frameset）主文档自带「Main Menu / Submit a Manuscript」等文字，
		// content iframe 还没提交时这一条会先命中，把「已登录的 EM」误判成 authed-other，
		// 于是复用登录态的 EM 抓取直接放弃（报告里那句「不是 Editorial Manager 主菜单」）。
		// 因此：content iframe 存在时（EM 的 frameset 外壳）一律继续等它落定/变成主菜单，
		// 只有「根本没有 content iframe」（无 frameset 的其它系统）或等满轮数才判定 authed-other。
		if (!cfSettled && (i >= 2 && !f || i >= 13)) {
			const txt = String(await pcBodyText(page) || "");
			if (txt.trim().length >= 80 && /(submission|manuscript|dashboard|author|profile|account|welcome)/i.test(txt)) {
				dbg.push("probe=authed-other url=" + page.url());
				return {
					kind: "authed-other",
					url: String(page.url?.() ?? "")
				};
			}
		}
		await page.waitForTimeout(700);
	}
	dbg.push("probe=none url=" + String(page.url?.() ?? ""));
	return { kind: "none" };
}
/** 登录 EM 期刊并返回作者主菜单信息（用于「新增期刊」自动识别 name/sections）。 */
async function loginAndGetMenu(baseUrl, username, password, browserPath) {
	const dbg = [];
	const browser = await launchChromium(browserPath);
	try {
		const page = await openBrowserPage(browser);
		const probe = await pcDetectSession(page, baseUrl, dbg);
		if (probe.kind === "authed-other") return {
			title: "",
			bodyText: "",
			counts: {},
			links: {},
			error: "已复用登录态（" + probe.url + "），但打开的页面不是 Editorial Manager 主菜单；自动识别只支持 EM，其他投稿系统需要单独的解析适配器"
		};
		const frame0 = probe.kind === "em" ? probe.frame : await openLoginFrame(page, baseUrl, dbg);
		const uVisible = !!frame0 && probe.kind !== "em";
		if (!frame0) return { title: "", bodyText: "", counts: {}, links: {}, error: "登录页未就绪（已重试 3 次）[" + dbg.join(" | ") + "]" };
		let frame = frame0;
		if (uVisible) {
			await frame.fill("input[name='username']", username).catch((e) => dbg.push("fillU=" + String(e).split("\n")[0]));
			await frame.fill("input[name='password']", password).catch((e) => dbg.push("fillP=" + String(e).split("\n")[0]));
			await frame.locator("input[name='authorLogin']").click().catch((e) => dbg.push("clickA=" + String(e).split("\n")[0]));
		}
		frame = await waitForMainMenu(page);
		if (!frame) return {
			title: "",
			bodyText: "",
			counts: {},
			links: {},
			error: "登录失败或未等到主菜单 [" + dbg.join(" | ") + "]"
		};
		const title = await frame.evaluate(() => {
			return document.querySelector("h1, h2, .pageTitle, #pageTitle")?.innerText?.trim() || document.title || "";
		}).catch(() => "");
		const { counts, links } = await scrapeMenu(frame);
		return {
			title,
			bodyText: await frame.evaluate(() => document.body ? document.body.innerText : "").catch(() => ""),
			counts,
			links
		};
	} catch (e) {
		return {
			title: "",
			bodyText: "",
			counts: {},
			links: {},
			error: String(e)
		};
	} finally {
		await browser.close().catch(() => {});
	}
}
async function scrapeEmJournal(j, browserPath) {
	const dbg = [];
	const browser = await launchChromium(browserPath);
	try {
		const page = await openBrowserPage(browser);
		const probe = await pcDetectSession(page, j.baseUrl, dbg);
		if (probe.kind === "authed-other") return {
			journal: j.name,
			system: "editorial-manager",
			error: "已复用登录态（" + probe.url + "），但该站点不是 Editorial Manager 主菜单，当前解析适配器抓不到数据；可把该期刊 system 设为 other，或等解析适配器支持该投稿系统"
		};
		const frame0 = probe.kind === "em" ? probe.frame : await openLoginFrame(page, j.baseUrl, dbg);
		const uVisible = !!frame0 && probe.kind !== "em";
		if (!frame0) return { journal: j.name, system: "editorial-manager", error: "登录页未就绪（已重试 3 次）[" + dbg.join(" | ") + "]" };
		let frame = frame0;
		if (uVisible) {
			await frame.fill("input[name='username']", j.username).catch((e) => dbg.push("fillU=" + String(e).split("\n")[0]));
			await frame.fill("input[name='password']", j.password).catch((e) => dbg.push("fillP=" + String(e).split("\n")[0]));
			const ab = frame.locator("input[name='authorLogin']");
			const abVisible = await ab.isVisible().catch(() => false);
			dbg.push("authorVisible=" + abVisible);
			await ab.click().catch((e) => dbg.push("clickA=" + String(e).split("\n")[0]));
		}
		frame = await waitForMainMenu(page);
		if (!frame) return {
			journal: j.name,
			system: "editorial-manager",
			error: "登录失败或未等到主菜单 [" + dbg.join(" | ") + "]"
		};
    const { counts, links } = await scrapeMenu(frame);
    const st = j.structure;
    const stSections = Array.isArray(st?.sections) ? st.sections : [];
    const secNames = [];
    const kindOf = {};
    const autoAdd = () => {
      for (const key of Object.keys(links)) {
        if (secNames.includes(key)) continue;
        const kt = key.toLowerCase();
        if (!/(submission|revision|decision)/.test(kt)) continue;
        if (/new submission|with production completed/.test(kt)) continue;
        if ((counts[key] ?? 0) > 0 && links[key]) {
          secNames.push(key);
          if (/with a decision/i.test(key)) kindOf[key] = "decision";
        }
      }
    };
    if (stSections.length) {
      for (const s of stSections) {
        const nm = typeof s?.name === "string" ? s.name : "";
        if (!nm || s.check === false || !links[nm] || secNames.includes(nm)) continue;
        secNames.push(nm);
        if (s.kind === "decision") kindOf[nm] = "decision";
      }
      autoAdd();
    } else {
      for (const sec of j.sections) if (sec && !secNames.includes(sec)) secNames.push(sec);
      autoAdd();
    }
    const sections = [];
		for (const secName of secNames) {
			const count = counts[secName] ?? 0;
			const href = links[secName];
			const submissions = [];
			const kind = kindOf[secName] ?? (/with a decision/i.test(secName) ? "decision" : void 0);
			if (count > 0 && href) {
				await frame.goto(href, {
					waitUntil: "domcontentloaded",
					timeout: 6e4
				}).catch(() => {});
				const rows = normalizeRows(kind === "decision" ? await scrapeTableAllPages(frame) : await parseTable(frame));
				if (/waiting for author|transfer/i.test(secName)) {
					for (const s of rows) if (/^reject|^decline/i.test(s.status)) s.status = "Awaiting Author Approval";
				}
				submissions.push(...rows);
			}
			sections.push({
				name: secName,
				count,
				submissions,
				kind
			});
		}
		return {
			journal: j.name,
			system: "editorial-manager",
			sections,
			groups: Array.isArray(st?.groups) ? st.groups : []
		};
	} catch (e) {
		return {
			journal: j.name,
			system: "editorial-manager",
			error: String(e)
		};
	} finally {
		await browser.close().catch(() => {});
	}
}
const STAGE_ZH = {
	submission: "审稿",
	revision: "修改",
	production: "生产"
};
function stageOf(secName, status) {
	const t = (secName + " " + status).toLowerCase();
	if (t.includes("production")) return "production";
	if (t.includes("revis")) return "revision";
	return "submission";
}
/** [patch 2026-10-22t] 已结束投稿的默认追溯范围（月）。 */
const DEFAULT_ENDED_MONTHS = 1;
/** [patch 2026-10-22t] 「已结束」状态：接受/拒稿/发表/撤稿/转投等。 */
function pcIsEndedStatus(status) {
	const t = String(status || "").toLowerCase();
	return /accept|reject|publish|withdraw|declin|transfer|complet|发表|出版|已拒|拒稿|接受|录用|撤回/.test(t);
}
/** [patch 2026-10-22t] 日期是否在最近 months 个月内（最小 1 个月）。 */
function pcWithinMonths(today, dateStr, months) {
	const d = parseEmDate(dateStr);
	if (!d) return false;
	const cut = new Date(today.getTime());
	cut.setMonth(cut.getMonth() - Math.max(1, Number(months) || DEFAULT_ENDED_MONTHS));
	return d.getTime() >= cut.getTime();
}
const MONTHS = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11
};
/** 解析 EM 常见日期格式（YYYY-MM-DD / MM/DD/YYYY / Mon DD YYYY / DD Mon YYYY / 带时间后缀），失败返回 null。 */
function parseEmDate(s) {
	const t = (s || "").trim();
	if (!t) return null;
	let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
	if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
	m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
	m = t.match(/^([A-Za-z]{3,9})[.\s]+(\d{1,2}),?\s+(\d{4})/);
	if (m) {
		const mon = MONTHS[m[1].toLowerCase().slice(0, 3)];
		if (mon !== void 0) return new Date(+m[3], mon, +m[2]);
	}
	m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})[.\s]+(\d{4})/);
	if (m) {
		const mon = MONTHS[m[2].toLowerCase().slice(0, 3)];
		if (mon !== void 0) return new Date(+m[3], mon, +m[1]);
	}
	const d = new Date(t);
	return isNaN(d.getTime()) ? null : d;
}
/** [patch 2026-10-22t] 已结束分区：只保留决策日期在最近 months 个月内的稿件（日期无法解析则视为历史，不列）。 */
function recentDecisions(subs, today, months) {
	return subs.filter((s) => pcWithinMonths(today, s.statusDate, months));
}
function formatReport(results, dateStr, endedMonths = DEFAULT_ENDED_MONTHS) {
	// [patch 2026-10-22t] 已结束投稿的追溯月数（配置 endedMonths，最小 1）
	const endMonths = Math.max(1, Number(endedMonths) || DEFAULT_ENDED_MONTHS);
	const lines = [`📊 每日投稿状态报告 (${dateStr})`, ""];
	let total = 0;
	let decisionTotal = 0;
	// [patch 2026-10-22u] 已结束投稿总数（不计入活跃投稿）
	let endedTotal = 0;
	const stageCounts = {
		submission: 0,
		revision: 0,
		production: 0
	};
	const today = /* @__PURE__ */ new Date();
	for (const r of results) {
		lines.push(`**${r.journal}:**`);
		if (r.error) {
			lines.push(`- ⚠️ ${r.error}`);
			continue;
		}
		// 通用抓取器成功时 system 可能是 'other'/sNAPP 等；只有「没有抓取结果」才走人工兜底提示
		if (r.system === "other" && !(r.sections ?? []).length) {
			lines.push("- 需 AI 手动检查（非 Editorial Manager，请用浏览器工具或 check_manuscript_status 交互式处理）");
			continue;
		}
		const sections = r.sections ?? [];
		const groupsOf = Array.isArray(r.groups) ? r.groups : [];
		const groupOf = (n) => { const g = groupsOf.find((x) => Array.isArray(x.sections) && x.sections.includes(n)); return (g && g.title) || ""; };
		let lastGroup = "";
		const secLines = [];
		// [patch 2026-10-22u] 已结束投稿统一收集到这里，最后作为「已结束」小节输出
		const endedLines = [];
		// [patch 2026-10-22v] 同一稿件可能同时出现在活跃分区与决策分区，按编号去重
		const endedSeen = /* @__PURE__ */ new Set();
		const pushEnded = (num, line) => {
			const k = String(num ?? "");
			if (k && endedSeen.has(k)) return;
			if (k) endedSeen.add(k);
			endedLines.push(line);
			endedTotal++;
		};
		let hasContent = false;
		for (const sec of sections) {
		  const gName = groupOf(sec.name);
		  if (gName && gName !== lastGroup) { secLines.push("### " + gName); lastGroup = gName; }
			const subs = sec.submissions ?? [];
			if (sec.kind === "decision") {
				const recent = recentDecisions(subs, today, endMonths);
				if (recent.length === 0) continue;
				hasContent = true;
				// [patch 2026-10-22u] 决策分区的条目并入统一「已结束」小节
				for (const s of recent) {
					const parts = [];
					if (s.statusDate) parts.push(`决策 ${s.statusDate}`);
					pushEnded(s.number, `  - [${zh(s.status)}] ${s.number}: ${s.title}${parts.length ? "（" + parts.join("，") + "）" : ""}`);
				}
				continue;
			}
			if (subs.length === 0) {
				if ((sec.count ?? 0) > 0) secLines.push(`- ⚠️ ${sec.name}（计数 ${sec.count}，未抓到稿件列表）`);
				continue;
			}
			hasContent = true;
			secLines.push(`- 📂 ${sec.name}（${sec.count}）`);
			for (const s of subs) {
				// [patch 2026-10-22u] 已结束（接受/拒稿/发表…）不算活跃投稿：窗口内的收进「已结束」小节
				if (pcIsEndedStatus(s.status)) {
					if (pcWithinMonths(today, s.statusDate, endMonths)) {
						const eparts = [];
						if (s.submitted) eparts.push(`投稿 ${s.submitted}`);
						if (s.statusDate) eparts.push(`更新 ${s.statusDate}`);
						pushEnded(s.number, `  - [${zh(s.status)}] ${s.number}: ${s.title}${eparts.length ? "（" + eparts.join("，") + "）" : ""}`);
					}
					continue;
				}
				const stage = stageOf(sec.name, s.status);
				stageCounts[stage]++;
				total++;
				const parts = [];
				if (s.submitted) parts.push(`投稿 ${s.submitted}`);
				if (s.statusDate) parts.push(`更新 ${s.statusDate}`);
				if (s.revDue) parts.push(`截止 ${s.revDue}`);
				secLines.push(`  - [${zh(s.status)}] ${s.number}: ${s.title}${parts.length ? "（" + parts.join("，") + "）" : ""}`);
			}
		}
		// [patch 2026-10-22u] 「已结束」小节（接受/拒稿/发表等，不计入活跃投稿）
		if (endedLines.length) {
			hasContent = true;
			secLines.push(`- 📂 已结束（最近 ${endMonths} 个月）`);
			for (const line of endedLines) secLines.push(line);
		}
		if (!hasContent) {
			lines.push("- 无活跃投稿（所有分区计数均为 0）。");
			lines.push("");
			continue;
		}
		lines.push(...secLines);
		lines.push("");
	}
	const stageSummary = [
		"submission",
		"revision",
		"production"
	].filter((k) => stageCounts[k] > 0).map((k) => `${STAGE_ZH[k]} ${stageCounts[k]} 篇`);
	let summary = `**摘要:** 共 ${total} 篇活跃投稿${stageSummary.length ? "（" + stageSummary.join(" · ") + "）" : ""}`;
	if (endedTotal > 0) summary += ` · 已结束 ${endedTotal} 篇`;
	lines.push(summary + "。");
	return lines.join("\n");
}
function pushServerChan(key, title, desp) {
	return new Promise((resolve) => {
		if (!key) return resolve(false);
		const body = JSON.stringify({
			title,
			desp
		});
		const req = https.request({
			hostname: "sctapi.ftqq.com",
			path: `/${key}.send`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(body)
			},
			timeout: 2e4
		}, (res) => {
			let buf = "";
			res.on("data", (chunk) => {
				buf += chunk;
			});
			res.on("end", () => {
				try {
					const parsed = JSON.parse(buf);
					// [patch 2026-10-22j] 失败时把返回体记下来，别再只写「失败」
					const okPush = res.statusCode === 200 && parsed && parsed.code === 0;
					if (!okPush) { try { log(defaultReportDir(), "微信推送失败详情: status=" + res.statusCode + " body=" + String(buf).slice(0, 300)); } catch {} }
					resolve(okPush);
				} catch {
					resolve(res.statusCode === 200);
				}
			});
		});
		req.on("error", () => resolve(false));
		req.on("timeout", () => {
			req.destroy();
			resolve(false);
		});
		req.write(body);
		req.end();
	});
}
/** 'HH:mm' → 当天分钟数（补跑判断用）。 */
function tMin(s) {
	const [h, m] = String(s ?? "").split(":").map(Number);
	return (h || 0) * 60 + (m || 0);
}
async function runCheck(config, env) {
	const results = [];
	for (const j of config.journals) results.push(await scrapeJournal(j, config.browserPath, env));
	return results;
}
/** 从会话事件里取第一条用户文本作为回退标题。 */
function fallbackSessionTitle(session) {
	try {
		for (const e of session.events ?? []) if (e.type === "user/message" && e.data?.message?.kind === "user") {
			for (const block of e.data.message.content ?? []) if (block.type === "text" && block.text) {
				const t = String(block.text).replace(/\s+/g, " ").trim();
				return t.length > 32 ? t.slice(0, 32) + "…" : t;
			}
		}
	} catch {}
	return "(未命名)";
}
/** 列出当前 live 会话（sessionId + cwd + 标题），供设置面板选择汇报目标。 */
// [local patch 2026-10-10b] Rebuild the provider/model list server-side: DSH 0.2 no longer exposes
// the client API llm.models (0 occurrences in the app bundle), so the panel reads this instead.
async function buildModelGroupsPC(llmService, settingsService) {
  const out = [];
  const seen = new Set();
  let defProvider = "";
  let defModel = "";
  try {
    const dm = settingsService && typeof settingsService.get === "function" ? settingsService.get("agent-default-model") : null;
    defProvider = (dm && dm.provider) || "";
    defModel = (dm && dm.model) || "";
  } catch (e) { /* ignore */ }
  const push = (id, name, models) => {
    if (!id) return;
    const list = (models ?? []).map((m) => ({ id: String((m && m.id) || m || ""), name: String((m && (m.name || m.id)) || m || "") })).filter((m) => !!m.id);
    // 目录为空也要保留 provider：面板的模型下拉有「识别模型（默认）」兜底，选空即用该 provider 的第一个模型
    const existing = out.find((g) => g.id === id);
    if (existing) {
      if (!existing.models.length && list.length) existing.models = list;
      if ((!existing.name || existing.name === existing.id) && name) existing.name = name;
      return;
    }
    seen.add(id);
    out.push({ id, name: name || id, models: list });
  };
  // 1) 真源：LLM 运行时注册表（官方 DeepSeek 账号这类内置 provider 只存在于这里，设置里查不到）
  try {
    const provs = llmService && typeof llmService.listProviders === "function" ? llmService.listProviders() : [];
    for (const p of provs || []) {
      const id = String((p && (p.id || p.provider)) || "");
      if (!id) continue;
      const name = String((p && (p.name || p.displayName || p.label)) || id);
      let models = [];
      try {
        const list = await llmService.listModels(id);
        models = Array.isArray(list) ? list : [];
      } catch (e) { /* 该 provider 没有目录：留给下面用设置里的声明补 */ }
      push(id, name, models);
    }
  } catch (e) { /* ignore */ }
  // 1b) 可配置 provider 目录：某些内置账号型 provider（官方 DeepSeek Account）在此声明，
  // 只有配置激活后才会进 adapters；settingsNs ≠ provider id（如 settingsNs llm-deepseek-account / provider deepseek-account）
  try {
    const dir = llmService && typeof llmService.listConfigurableProviders === "function" ? llmService.listConfigurableProviders() : [];
    for (const e of dir || []) {
      const id = String((e && (e.provider || e.id)) || "");
      if (!id) continue;
      const name = String((e && (e.displayName || e.name)) || id);
      let models = [];
      try {
        const list = await llmService.listModels(id);
        models = Array.isArray(list) ? list : [];
      } catch (e2) { /* 未激活时没有模型目录：仍显示 provider，模型留空走默认 */ }
      push(id, name, models);
    }
  } catch (e) { /* ignore */ }
  // 2) 设置里声明的 providers（部分可配置 provider 不在运行时注册表里）
  try {
    const rows = settingsService && typeof settingsService.describe === "function" ? settingsService.describe() : [];
    for (const d of rows || []) {
      const v = d && d.value;
      if (!v || typeof v !== "object") continue;
      const provs = v.providers;
      if (!provs || typeof provs !== "object") continue;
      for (const k of Object.keys(provs)) {
        const p = provs[k] || {};
        // [local patch 2026-10-22] 没配 API key 的 provider 是死的：不进下拉，免得用户选到必然失败的供应商
        if (!pcProviderKeyOkPC(p)) continue;
        push(k, p.name || k, Array.isArray(p.models) ? p.models : []);
      }
    }
    for (const d of rows || []) {
      const v = d && d.value;
      if (!v || typeof v !== "object") continue;
      if (v.providers && typeof v.providers === "object") continue;
      if (!Array.isArray(v.models) || !v.models.length) continue;
      const ids = v.models.map((m) => String((m && m.id) || m || ""));
      if (defProvider && defModel && ids.includes(defModel)) push(defProvider, defProvider, v.models);
    }
  } catch (e) { /* ignore */ }
  // 3) 兜底：默认 provider 至少出现在下拉里（识别默认就走它），否则面板空白
  if (defProvider && !seen.has(defProvider)) push(defProvider, defProvider, defModel ? [{ id: defModel, name: defModel }] : []);
  // [local patch 2026-10-22c] 排序：官方 DeepSeek 账号排第一（用户默认用它识别），其次 agent-default-model 的 provider，其余按 id
  const pcRank = (id) => {
    const s0 = String(id || "").toLowerCase();
    if (s0 === "deepseek-account") return 0;
    if (defProvider && s0 === String(defProvider).toLowerCase()) return 0.5;
    if (s0.indexOf("deepseek") === 0) return 1;
    return 2;
  };
  out.sort((a, b) => {
    const ra = pcRank(a.id);
    const rb = pcRank(b.id);
    if (ra !== rb) return ra - rb;
    return String(a.id).localeCompare(String(b.id));
  });
  // [local patch 2026-10-22] 只留「有模型目录」的 provider（默认 provider 例外，保证下拉不为空）。
  // 之前把 listConfigurableProviders() 里几十个未激活供应商（amazon-bedrock / openai / …）全塞进下拉，用户报「无效供应商」。
  return out.filter((g) => (g.models && g.models.length > 0) || g.id === defProvider);
}
// [local patch 2026-10-22] provider 是否真的能用：pi-ai 这类靠 apiKeyEnv 取 key，环境变量缺失就是死配置
function pcProviderKeyOkPC(p) {
  try {
    if (!p || typeof p !== "object") return true;
    if (typeof p.apiKey === "string" && p.apiKey.trim()) return true;
    if (typeof p.apiKeyEnv === "string" && p.apiKeyEnv.trim()) {
      const k = p.apiKeyEnv.trim();
      return !!(typeof process !== "undefined" && process.env && process.env[k]);
    }
    return true;
  } catch (e) { return true; }
}
// [local patch 2026-10-22] 配置里的「识别用 provider」可能是历史遗留的无效值（被当成 provider id 的设置命名空间名，
// 例如 llm-deepseek-account）。透传给 llm.stream 只会静默拿到空输出，所以统一在这里判定；无效就回退默认模型。
function pcValidProviderPC(llmService, id, settingsService) {
  const want = String(id ?? "");
  if (!want) return false;
  try {
    const provs = llmService && typeof llmService.listProviders === "function" ? llmService.listProviders() : [];
    if ((provs || []).some((p) => String((p && (p.id || p.provider)) || "") === want)) return true;
    const dir = llmService && typeof llmService.listConfigurableProviders === "function" ? llmService.listConfigurableProviders() : [];
    if ((dir || []).some((e) => String((e && (e.provider || e.id)) || "") === want)) return true;
    // pi-ai 这类可配置 provider：没激活时不在运行时注册表里，但设置在 providers 里声明过，用户选它是合法的
    const rows = settingsService && typeof settingsService.describe === "function" ? settingsService.describe() : [];
    for (const d of rows || []) {
      const provs2 = d && d.value && d.value.providers;
      if (provs2 && typeof provs2 === "object" && Object.prototype.hasOwnProperty.call(provs2, want)) return true;
    }
    return false;
  } catch (e) { return false; }
}// [local patch 2026-10-10d] List EVERY session, not just live ones: live sessions can receive the report,
// the rest come from DSH's session index (~/.dsh/storages/session_projcache/sessions) and are
// marked as not-open so the panel does not imply a report can be delivered there.
function listAllSessionsPC(agents, sessions, sessionTitle) {
  const out = [];
  const seen = new Set();
  try {
    const live = sessions && typeof sessions.list === "function" ? sessions.list() : [];
    for (const s of live || []) {
      let t = "";
      try { t = sessionTitle?.get?.(s)?.title ?? fallbackSessionTitle(s); } catch (e) { t = ""; }
      out.push({ sessionId: s.id, cwd: s.header?.cwd ?? "", title: (t && String(t).trim()) || "(未命名)", running: agents?.get?.(s.id)?.status === "running", live: true });
      seen.add(s.id);
    }
  } catch (e) { /* ignore */ }
  try {
    const dir = join(homedir(), ".dsh", "storages", "session_projcache", "sessions");
    const names = readdirSync(dir);
    const rows = [];
    for (const n of names) {
      if (!/^session-.+\.json$/.test(n)) continue;
      const id = n.slice(0, -5); // [local patch 2026-10-10f] keep "session-" prefix: DSH canonical id
      if (seen.has(id)) continue;
      try {
        const j = JSON.parse(readFileSync(join(dir, n), "utf8"));
        const r = (j && j.record) || {};
        const t = r.rows && r.rows.title ? r.rows.title.val : "";
        rows.push({ sessionId: id, cwd: (r.identity && r.identity.cwd) || "", title: (typeof t === "string" && t.trim()) ? t.trim() + "（未打开）" : "(未命名)（未打开）", running: false, live: false, at: (r.identity && r.identity.createdAt) || 0 });
      } catch (e) { /* skip unreadable entry */ }
    }
    rows.sort((a, b) => (b.at || 0) - (a.at || 0));
    for (const r of rows) out.push(r);
  } catch (e) { /* ignore */ }
  return out;
}
function listLiveSessions(agents, sessions, sessionTitle) {
	const out = [];
	try {
		for (const s of sessions.list() ?? []) {
			const title = sessionTitle?.get?.(s)?.title ?? fallbackSessionTitle(s);
			out.push({
				sessionId: s.id,
				cwd: s.header?.cwd ?? "",
				title,
				running: agents?.get?.(s.id)?.status === "running"
			});
		}
	} catch {}
	out.sort((a, b) => String(a.title).localeCompare(String(b.title), "zh"));
	return out;
}
/** 往指定 live 会话注入一条用户消息（报告），触发 agent 简短确认。返回 'ok' 或失败原因。 */
// [local patch 2026-10-10e] Deliver the report even when the target session is NOT open: the host agents
// service exposes ensureSession(sessionId, cwd, checkPersistedIdentity, presetId) which resumes a
// cold session and returns its live agent. cwd comes from the session index (a cold session is not
// loaded, so sessions.get() cannot supply it).
function cwdFromIndexPC(sessionId) {
  try {
    const raw = String(sessionId || "");
    const base = raw.startsWith("session-") ? raw : "session-" + raw;
    const j = JSON.parse(readFileSync(join(homedir(), ".dsh", "storages", "session_projcache", "sessions", base + ".json"), "utf8"));
    return (j && j.record && j.record.identity && j.record.identity.cwd) || "";
  } catch (e) { return ""; }
}
/** 往指定会话注入一条用户消息（报告）。会话未打开时先按需载入。返回 'ok' 或失败原因。 */
async function reportToSession(agents, sessions, sessionId, report) {
  // [patch 2026-10-22e/w] public host entry: sessionController.prompt(request, signal) resumes a cold session then followup.
  // agents.ensureSession no longer exists on this host ("is not a function").
  try {
    const __sc0 = __pcSCRef || ((__pcCtx && typeof __pcCtx.get === "function") ? __pcCtx.get("sessionController") : null);
    if (__sc0 && typeof __sc0.prompt === "function" && sessionId) {
      const __pcTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return void 0; } })();
      const __pcReqId = (() => { try { if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID(); } catch (e) { /* fallback */ } return String(Date.now()) + "-" + Math.random().toString(16).slice(2); })();
      const __pcReq = { requestId: __pcReqId, sessionId, mode: "queue", content: [{ type: "text", text: "\u23f0 \u6bcf\u65e5\u6295\u7a3f\u72b6\u6001\u81ea\u52a8\u6c47\u62a5\uff08\u63d2\u4ef6 \u6295\u7a3f\u72b6\u6001\u8ffd\u8e2a\uff09\uff1a\n\n" + report + "\n\n\u2014\u2014\u8bf7\u4e00\u53e5\u8bdd\u786e\u8ba4\u6536\u5230\u5373\u53ef\uff0c\u4e0d\u8981\u91cd\u65b0\u68c0\u67e5\u3001\u4e0d\u8981\u8c03\u7528\u5de5\u5177\u3002" }] };
      if (__pcTz) __pcReq.clientTimeZone = __pcTz;
      await __sc0.prompt(__pcReq, new AbortController().signal);
      return "ok";
    }
  } catch (e) {
    try { log(defaultReportDir(), "[delivery] prompt channel failed: " + String(e).slice(0, 200)); } catch {}
  }
  // [local patch] 冷对话投递：在所有早退分支之前先尝试"载入会话 + 等 agent 就绪"，就绪即投递。
  // 原实现只在会话已打开（live）时能发；这里补上冷会话路径，失败则完全回退到原逻辑。
  const __pcPre = await (async () => {
    try {
      const quick = (agents && typeof agents.get === "function") ? agents.get(sessionId) : null;
      if (quick && typeof quick.followup === "function") return quick;
      let cwd0 = "";
      try { cwd0 = cwdFromIndexPC(sessionId) || ""; } catch (e) { cwd0 = ""; }
      await __pcLoadSession(sessionId, cwd0);
      const a0 = await __pcAwaitAgent(sessionId, 8000);
      return a0;
    } catch (e) { return null; }
  })();
  if (__pcPre && typeof __pcPre.followup === "function") {
    try { __pcPre.followup(__pcBuildMsg(report)); return "ok"; } catch (e) { /* 落到原逻辑 */ }
  }
  // [local patch] 插件可见的 ctx.agents 没有 ensureSession；宿主内部有它的是 sessionController.agents
  // （枚举实证：sessionController.keys 含 agents；agents.keys 不含 ensureSession）
  let __pcAg = agents;
  try { const __sc = (__pcCtx && typeof __pcCtx.get === "function") ? __pcCtx.get("sessionController") : null; if (__sc && __sc.agents) __pcAg = __sc.agents; } catch (e) { /* 回退到插件可见的 agents */ }
  if (!sessionId) return "未配置汇报会话";
  let agent = agents.get(sessionId);
  if (!agent || typeof agent.followup !== "function") {
    try {
      if (typeof (__pcAgents() || {}).ensureSession === "function") {
        let cwd = "";
        try { cwd = sessions?.get?.(sessionId)?.header?.cwd || ""; } catch (e) { cwd = ""; }
        if (!cwd) cwd = cwdFromIndexPC(sessionId);
        agent = await __pcAg.ensureSession(sessionId, cwd, true);
      }
    } catch (e) { /* fall through to the error below */ }
  }
  if (!agent || typeof agent.followup !== "function") agent = agents.get(sessionId);
  // [local patch] 冷会话投递：ensureSession 用一组参数可能失败，这里换 cwd 来源 × checkPersistedIdentity 组合重试；
  // 全部失败才报错，并把宿主返回的真实错误带出来（便于定位，而不是只留一句"未成功"）。
  let __pcLastErr = "";
  try {
    if (typeof (__pcAgents() || {}).ensureSession === "function") {
      const __pcCands = [];
      let __pcC1 = ""; try { __pcC1 = sessions?.get?.(sessionId)?.header?.cwd || ""; } catch (e) { __pcC1 = ""; }
      const __pcC2 = cwdFromIndexPC(sessionId);
      if (__pcC1) __pcCands.push(__pcC1);
      if (__pcC2 && __pcC2 !== __pcC1) __pcCands.push(__pcC2);
      __pcCands.push(process.cwd() || ".");
      for (const __cw of __pcCands) {
        for (const __chk of [true, false]) {
          try {
            const __a2 = await __pcAg.ensureSession(sessionId, __cw, __chk);
            if (__a2 && typeof __a2.followup === "function") { agent = __a2; break; }
          } catch (e) { __pcLastErr = String(e && e.message ? e.message : e); }
        }
        if (agent && typeof agent.followup === "function") break;
      }
    }
  } catch (e) { __pcLastErr = String(e && e.message ? e.message : e); }
  if (!agent || typeof agent.followup !== "function") agent = agents.get(sessionId);
  // 冷会话：先把它 attach 到所属 workspace（界面点开会话的第二半），再取 agent
  const __pcAtt = await __pcAttachWorkspace(sessionId);
  if (!agent || typeof agent.followup !== "function") { try { agent = agents.get(sessionId); } catch (e) { /* ignore */ } }
  if (!agent || typeof agent.followup !== "function") {
    try { agent = await __pcAg.ensureSession(sessionId, cwdFromIndexPC(sessionId) || "", true); } catch (e) { __pcLastErr = __pcLastErr || String(e && e.message ? e.message : e); }
  }
  if (!agent || typeof agent.followup !== "function") { try { agent = agents.get(sessionId); } catch (e) { /* ignore */ } }
  // 冷会话：用控制器的公开入口载入，然后等 agent 就绪再投递
  if (!agent || typeof agent.followup !== "function") {
    const __pcLoad = await __pcLoadSession(sessionId, (function () { try { return cwdFromIndexPC(sessionId) || ""; } catch (e) { return ""; } })());
    const __pcA = await __pcAwaitAgent(sessionId, 8000);
    if (__pcA) { agent = __pcA; } else { __pcLastErr = __pcLastErr || ("载入=" + __pcLoad); }
  }
  return `会话 ${sessionId} 无法载入（非 live；ensureSession 失败: ${__pcLastErr || "原因未知"}${__pcAtt ? " / attach=" + __pcAtt : ""}${__pcCwdUsed ? " / cwd=" + __pcCwdUsed : ""}）`;
  const message = createUserMessage({
    content: [{ type: "text", text: "⏰ 每日投稿状态自动汇报（插件 投稿状态追踪）：\n\n" + report + "\n\n——请一句话确认收到即可，不要重新检查、不要调用工具。" }],
    source: { kind: "user" }
  });
  agent.followup(message);
  return "ok";
}
/** 用 LLM 生成一段文本（provider/model 可覆盖；为空则读 agent-default-model）。 */
async function callLlmText(llmService, settingsService, prompt, providerOverride, modelOverride) {
	let provider = "deepseek-official";
	let model = "deepseek-v4-pro";
	try {
		const dm = settingsService?.get?.("agent-default-model");
		if (dm?.provider) provider = dm.provider;
		if (dm?.model) model = dm.model;
	} catch {}
	if (providerOverride) {
		provider = providerOverride;
		if (modelOverride) model = modelOverride;
		else try {
			const models = await llmService.listModels(providerOverride);
			if (Array.isArray(models) && models.length > 0) model = models[0].id;
		} catch {}
	} else if (modelOverride) model = modelOverride;
	const messages = [createUserMessage({
		content: [{
			type: "text",
			text: prompt
		}],
		source: { kind: "user" }
	})];
	for (const effort of ["off", void 0]) {
		const out = [];
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 18e4);
		try {
			const stream = llmService.stream({
				provider,
				model,
				...effort === void 0 ? {} : { reasoningEffort: effort },
				messages,
				maxTokens: 8e3,
				signal: controller.signal
			});
			for await (const chunk of stream) if (chunk?.type === "text-delta" && chunk.text) out.push(chunk.text);
		} catch (e) {
			// [local patch 2026-10-22] 以前异常会被上层吞成「模型没有返回 JSON: 」；把 provider/model 和真实原因带出去
			const msg = String((e && e.message) || e).split("\n")[0];
			throw new Error("模型调用失败（" + provider + (model ? " / " + model : "") + "）：" + msg.slice(0, 300));
		} finally {
			clearTimeout(timer);
		}
		if (out.length > 0) return out.join("");
	}
	return "";
}
/** 分析 EM 主菜单文本，识别期刊名 + 系统类型（分区由页面确定性探测提供，不依赖模型，避免漏/错）。 */
async function analyzeJournalMenu(llmService, settingsService, baseUrl, menu, providerOverride, modelOverride) {
  const counts = menu.counts ?? {};
  const linkNames = Object.keys(menu.links ?? menu.counts ?? {});
  const menuList = linkNames.map((n) => "- " + n + (counts[n] !== undefined ? " (" + counts[n] + ")" : "")).join("\n");
  const prompt = [
    "你是学术期刊投稿系统配置助手。下面是某投稿系统登录后「作者主菜单」的全部链接名与菜单文本。",
    "请识别：期刊名、系统类型，以及整个主菜单的组织结构（分区清单与分组），供后续每日检查程序直接使用。",
    "",
    "硬性要求：",
    "1. sections[].name 必须逐字取自下面「链接名清单」中的某一项，不要改写、不要翻译、不要发明；",
    "2. 只有稿件列表类分区才 check=true；发起新投稿的入口、已完成/归档、任务分配类一律 check=false；",
    "3. kind 取值：active（处理中）、revision（修改中）、decision（已决策历史）、entry（投稿入口）、archive（已完成归档）、other；",
    "4. sections 按菜单阅读顺序排列；",
    "5. groups[].sections 必须是 sections[].name 的子集，用于报告分节展示；",
    "6. 只输出一个 JSON 对象，不要 markdown 代码块、不要多余说明。",
    "",
    "站点地址：" + baseUrl,
    "页面标题：" + (menu.title || "(无)"),
    "",
    "链接名清单：",
    menuList.slice(0, 4000),
    "",
    "菜单文本：",
    String(menu.bodyText ?? "").slice(0, 4000),
    "",
    "JSON 格式：",
    '{"name":"期刊名","system":"editorial-manager","groups":[{"title":"分组名","sections":["分区名"]}],"sections":[{"name":"分区名","kind":"active","check":true}]}'
  ].join("\n");
  const text = await callLlmText(llmService, settingsService, prompt, providerOverride, modelOverride);
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { error: "模型未返回有效 JSON: " + text.slice(0, 200) };
  try {
    const obj = JSON.parse(m[0]);
    const allowed = new Set(linkNames);
    const seen = new Set();
    const secs = [];
    for (const s of Array.isArray(obj.sections) ? obj.sections : []) {
      const nm = typeof (s?.name) === "string" ? s.name.trim() : "";
      if (!nm || !allowed.has(nm) || seen.has(nm)) continue;
      seen.add(nm);
      secs.push({ name: nm, kind: typeof (s?.kind) === "string" ? s.kind : "other", check: s?.check !== false });
    }
    for (const nm of linkNames) {
      if (seen.has(nm)) continue;
      const kt = nm.toLowerCase();
      if (!/(submission|revision|decision)/.test(kt)) continue;
      if (/new submission|with production completed|task assignment/.test(kt)) continue;
      if ((counts[nm] ?? 0) <= 0) continue;
      seen.add(nm);
      secs.push({ name: nm, kind: /with a decision/i.test(nm) ? "decision" : "active", check: true });
    }
    const groups = (Array.isArray(obj.groups) ? obj.groups : []).map((g) => ({ title: typeof (g?.title) === "string" ? g.title : "", sections: (Array.isArray(g?.sections) ? g.sections : []).filter((x) => typeof x === "string" && seen.has(x)) })).filter((g) => g.sections.length > 0);
    return { structure: { name: typeof obj.name === "string" ? obj.name.trim() : "", system: typeof obj.system === "string" ? obj.system.trim() : "", groups, sections: secs } };
  } catch (e) {
    return { error: "JSON 解析失败: " + String(e) + " | " + text.slice(0, 200) };
  }
}
function apply(ctx, config) {
	let getConfigRaw = () => config;
  // [local patch] 每次读取都合并落盘值，避免"改完设置要重启"
  __pcCtx = ctx;
  const getConfigMerged = () => {
    const base = getConfigRaw();
    try {
      const p = readPersistedPC();
      if (!p) return base;
      const merged = { ...base, ...p };
      try { return Config(merged); } catch (e) { return merged; }
    } catch (e) { return base; }
  };
  // [patch 2026-10-22p] 配置热更新：定时检查/立即检查/登录一次/工具都读这个合并值，
  // 所以面板保存后立刻用新配置，无需重启 DSH。
  let getConfig = () => getConfigMerged();
	installSettingsSection(ctx, "manuscript-tracker", Config, config, {
		setSource: (fn) => {
			getConfigRaw = fn;
		},
		onChange: () => {}
	});
	const reportDir = () => getConfigMerged().reportDir || defaultReportDir();
	// [patch 2026-10-22e] capture service refs while active
	try { __pcSCRef = ctx.get("sessionController"); } catch {}
	try { __pcAgentsRef = ctx.agents; } catch {}
	try { __pcSessionsRef = ctx.sessions; } catch {}
	mkdirSync(reportDir(), { recursive: true });
	let settingsService = null;
	ctx.inject(["settings"], (sctx) => {
		settingsService = sctx.settings;
	});
	let sessionTitleService = null;
	ctx.inject(["sessionTitle"], (sctx) => {
		sessionTitleService = sctx.sessionTitle;
	});
	// [local patch] 第二步：通用抓取器的 LLM 环境（结构识别 / 文本回退抽取都走插件已有的 callLlmText）
	const pcScrapeEnv = (cfg) => {
		const c = cfg ?? getConfigMerged();
		let providerOverride = c.discoverProvider || void 0;
		let modelOverride = c.discoverModel || void 0;
		// [local patch 2026-10-22] provider 不在运行时注册表里就别透传：llm.stream 会静默吐空文本，
		// 面板只会看到「模型没有返回 JSON: 」这种没法排查的错。这里回退到 agent-default-model。
		if (providerOverride && !pcValidProviderPC(ctx.llm, providerOverride, settingsService)) {
			try { log(reportDir(), "识别 provider 未注册，回退默认模型: " + String(providerOverride)); } catch (e) { /* ignore */ }
			providerOverride = void 0;
			modelOverride = void 0;
		}
		return {
			llmService: ctx.llm,
			settingsService,
			providerOverride,
			modelOverride
		};
	};
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/manuscript-tracker/api",
		handler: async (req, res) => {
			const send = (code, obj) => {
				res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
				res.end(JSON.stringify(obj));
			};
			try {
				const p = new URL(req.url ?? "/", "http://localhost").pathname.replace(/^\/manuscript-tracker\/api/, "") || "/";
				if (req.method === "GET" && p === "/config") {
					if (!settingsService?.describe) return send(500, {
						ok: false,
						error: "settings 服务不可用"
					});
					const desc = settingsService.describe().find((d) => d.ns === "manuscript-tracker");
					const modelGroups = await (async () => { try { return await buildModelGroupsPC(ctx.llm, settingsService) } catch (e) { return [] } })();
					const __baseCfg = { ...(desc?.value ?? getConfig()) };
					// [local patch 2026-10-22] 落盘值只补「运行态缺失」的字段。早期实现是整体覆盖，
					// 结果面板里刚删掉的期刊会在下次 GET 时被旧快照盖回来（用户报「删除期刊失效」）。
					try {
						const __pp = readPersistedPC();
						if (__pp && typeof __pp === "object") for (const k of Object.keys(__pp)) {
							const cur = __baseCfg[k];
							const missing = cur === void 0 || cur === null || cur === "" || Array.isArray(cur) && cur.length === 0;
							if (missing) __baseCfg[k] = __pp[k];
						}
					} catch (e) { /* ignore */ }
					// 历史配置里可能存着无效 provider（设置命名空间名）：直接显示为空，回到默认模型
					if (__baseCfg.discoverProvider && !pcValidProviderPC(ctx.llm, __baseCfg.discoverProvider, settingsService)) {
						__baseCfg.discoverProvider = "";
						__baseCfg.discoverModel = "";
					} else if (__baseCfg.discoverProvider) {
						const g = modelGroups.find((x) => x.id === __baseCfg.discoverProvider);
						const ids = new Set(((g && g.models) || []).map((m) => m.id));
						if (__baseCfg.discoverModel && ids.size && !ids.has(String(__baseCfg.discoverModel))) __baseCfg.discoverModel = "";
					}
					// [patch 2026-10-22p] runtime = 插件进程当前真正在用的配置（已合并落盘），用来确认热更新生效
					const runtime = (() => { try { const c = getConfig(); return { time: c.time, timezone: c.timezone, scheduleEnabled: c.scheduleEnabled, journals: (c.journals || []).length, reportSessionId: c.reportSessionId || "" }; } catch (e) { return null; } })();
					return send(200, {
						ok: true,
						config: __baseCfg,
						runtime,
						revision: desc?.revision ?? 0,
						sessions: (function () { try { return listAllSessionsPC(ctx.agents, ctx.sessions, sessionTitleService) } catch (e) { return [] } })(),
						modelGroups
					});
				}
				if (req.method === "GET" && p === "/sessions") return send(200, {
					ok: true,
					sessions: listLiveSessions(ctx.agents, ctx.sessions, sessionTitleService)
				});
				if (req.method === "POST" && p === "/config") {
					const body = JSON.parse(await readBody(req));
					const value = body?.config;
					const expectedRevision = body?.expectedRevision;
					if (!settingsService?.mutate) return send(500, {
						ok: false,
						error: "settings 服务不可用"
					});
					await settingsService.mutate("manuscript-tracker", Object.keys(value ?? {}).map((k) => ({ op: "set", path: [k], value: value[k] })), expectedRevision);
					return send(200, {
						ok: true,
						revision: settingsService.describe().find((d) => d.ns === "manuscript-tracker")?.revision ?? 0
					});
				}
				if (req.method === "POST" && p === "/run") {
				  const cfgRun = getConfigMerged();
				  const reportRun = formatReport(await runCheck(cfgRun, pcScrapeEnv(cfgRun)), (new Date()).toISOString().slice(0, 10), cfgRun.endedMonths);
				  let deliver = "";
				  if (cfgRun.reportSessionId) {
				    try { deliver = await reportToSession(__pcAgentsRef || ctx.agents, __pcSessionsRef || ctx.sessions, cfgRun.reportSessionId, reportRun); } catch (e) { deliver = "汇报异常: " + String(e); }
				  }
				  return send(200, { ok: true, report: reportRun, deliver });
				}
				if (req.method === "POST" && p === "/report") {
					const cfg = getConfigMerged();
					const dir = cfg.reportDir || defaultReportDir();
					let report = "";
					try {
						report = readFileSync(join(dir, "latest.md"), "utf8");
					} catch {}
					if (!report) report = formatReport(await runCheck(cfg, pcScrapeEnv(cfg)), (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), cfg.endedMonths);
					return send(200, {
						ok: true,
						result: await reportToSession(__pcAgentsRef || ctx.agents, __pcSessionsRef || ctx.sessions, cfg.reportSessionId, report)
					});
				}

				if (req.method === "POST" && p === "/run-one") {
				  const body = JSON.parse(await readBody(req));
				  const one = body?.journal;
				  if (!one || typeof one !== "object" || !one.baseUrl) return send(400, { ok: false, error: "缺少 journal.baseUrl" });
				  const cfgOne = getConfigMerged();
				  const jOne = {
				    name: String(one.name ?? "") || new URL(String(one.baseUrl)).hostname,
				    baseUrl: String(one.baseUrl).replace(/\/+$/, "").replace(/\/default\.aspx$/i, "").replace(/\/+$/, ""),
				    username: String(one.username ?? ""),
				    password: String(one.password ?? ""),
				    sections: Array.isArray(one.sections) ? one.sections : [],
				    system: String(one.system ?? "editorial-manager"),
				    structure: one.structure
				  };
				  const dateOne = (new Date()).toISOString().slice(0, 10);
				  const rOne = await scrapeJournal(jOne, cfgOne.browserPath, pcScrapeEnv(cfgOne));
				  const reportOne = formatReport([rOne], dateOne, cfgOne.endedMonths);
				  let deliverOne = "";
				  if (cfgOne.reportSessionId) {
				    try { deliverOne = await reportToSession(__pcAgentsRef || ctx.agents, __pcSessionsRef || ctx.sessions, cfgOne.reportSessionId, reportOne); } catch (e) { deliverOne = "汇报异常: " + String(e); }
				  }
				  return send(200, { ok: true, report: reportOne, single: true, deliver: deliverOne });
				}
				// 人工登录一次（B 方案）：用共享 profile 打开有头浏览器，用户自己完成 ORCID / 学校 SSO 登录，
				// 登录态落到 ~/.dsh/manuscript-tracker/browser-profile，之后的无头抓取直接复用 cookie。
				if (req.method === "POST" && p === "/login-once") {
					const body = JSON.parse(await readBody(req));
					const baseUrl = String(body?.baseUrl ?? "").trim().replace(/\/+$/, "").replace(/\/default\.aspx$/i, "").replace(/\/+$/, "");
					if (!baseUrl) return send(400, {
						ok: false,
						error: "缺少 baseUrl（期刊入口网址）"
					});
					if (__pcLoginOnceBusy) return send(409, {
						ok: false,
						error: "已有一个登录窗口在等待完成，请先在那个窗口里登录或把它关掉"
					});
					const journalName = String(body?.journalName ?? "").trim();
					__pcLoginOnceBusy = true;
					try {
						log(reportDir(), "登录一次开始 baseUrl=" + baseUrl);
						const envOnce = pcScrapeEnv();
						const rOnce = await loginOnce(baseUrl, getConfigMerged().browserPath, async (ctxAny, finalUrl, keyUrl) => await pcRecognizeStructure({
							baseUrl: keyUrl || baseUrl,
							journalName,
							ctxAny,
							llmService: ctx.llm,
							settingsService,
							providerOverride: envOnce.providerOverride,
							modelOverride: envOnce.modelOverride
						}));
						const rec = rOnce.structure ?? null;
						const plan = rec?.plan ?? null;
						const planPath = String(rec?.planPath ?? "");
						let planError = rec?.error ? String(rec.error) : "";
						// [local patch 2026-10-22] 若识别失败且登录页是统一身份/SSO 门户，直接告诉用户"这不是投稿系统"
						try {
							const __hosts = (rOnce.pages ?? []).map((x) => { try { return new URL(String(x.url || "")).hostname.toLowerCase(); } catch { return ""; } }).filter(Boolean);
							const __portal = __hosts.filter((h) => /^(accounts\.)?taylorfrancis\.com$|orcid\.org$|login\.microsoftonline\.com$|^sso\.|^login\.|^auth\./i.test(h));
							if (!plan && planError && __portal.length) {
								planError += "\n看起来你登录的是统一身份门户（" + Array.from(new Set(__portal)).join(" / ") + "），它不是投稿系统、里面没有稿件列表，所以识别不出结构。请改为粘贴投稿系统本身的网址（常见是 https://www.editorialmanager.com/<期刊代码> 或 https://mc.manuscriptcentral.com/<代码>），登录后停在「作者中心 / 我的稿件」那一页再点登录一次。";
							}
						} catch {}
						log(reportDir(), "登录一次结束 ok=" + rOnce.ok + " finalUrl=" + (rOnce.finalUrl ?? "") + " waitedMs=" + (rOnce.waitedMs ?? 0) + " system=" + String(plan?.system ?? "") + " conf=" + String(plan?.confidence ?? "") + (planError ? " planError=" + planError : "") + " error=" + String(rOnce.error ?? "").slice(0, 300) + " closed=" + String(rOnce.closedByUser ?? "") + " pages=" + (Array.isArray(rOnce.pages) ? rOnce.pages.length : 0) + " creds=" + (rOnce.creds ? "yes" : "no"));
						return send(200, {
							ok: rOnce.ok,
							finalUrl: rOnce.finalUrl ?? "",
							waitedMs: rOnce.waitedMs ?? 0,
							plan: plan ? { system: plan.system, confidence: plan.confidence, listUrl: plan.listUrl, fields: plan.fields } : null,
							planPath,
							planError,
							pages: Array.isArray(rOnce.pages) ? rOnce.pages.slice(0, 60) : [],
							credentials: rOnce.creds ?? null,
							profileDir: pcProfileDir(),
							bestUrl: rOnce.bestUrl ?? ""
						});
					} finally {
						__pcLoginOnceBusy = false;
					}
				}
				if (req.method === "POST" && p === "/discover") {
					const body = JSON.parse(await readBody(req));
					const baseUrl = String(body?.baseUrl ?? "").trim().replace(/\/+$/, "").replace(/\/default\.aspx$/i, "").replace(/\/+$/, "");
					const username = String(body?.username ?? "").trim();
					const password = String(body?.password ?? "");
					if (!baseUrl || !username || !password) return send(400, {
						ok: false,
						error: "网址/账号/密码不能为空"
					});
					const menu = await loginAndGetMenu(baseUrl, username, password, getConfigMerged().browserPath);
					if (menu.error) return send(200, {
						ok: false,
						error: menu.error
					});
          const cfgNow = getConfigMerged();
          const parsed = await analyzeJournalMenu(ctx.llm, settingsService, baseUrl, menu, cfgNow.discoverProvider, cfgNow.discoverModel);
          const st = parsed.structure;
          const detSections = Object.keys(menu.counts).filter((k) => !/with production completed|task assignment/i.test(k));
          const sections = st ? st.sections.filter((s) => s.check).map((s) => s.name) : detSections;
          let name = (menu.title?.trim?.()) || "";
          const titleGeneric = !name || name.length < 3 || /editorial manager|author main menu|main menu|welcome/i.test(name);
          if (titleGeneric && st?.name) name = st.name;
          if (!name) name = new URL(baseUrl).hostname.replace(/^www\./, "").replace(/\.editorialmanager\.com$/, "");
          const system = "editorial-manager";
          const structure = st ? { source: "llm", model: cfgNow.discoverModel || "", capturedAt: (new Date()).toISOString(), name: st.name, system: st.system, groups: st.groups, sections: st.sections } : { source: "", model: "", capturedAt: "", name: "", system: "", groups: [], sections: [] };
          return send(200, { ok: true, config: { name, baseUrl, username, sections, system, structure }, llmError: parsed.error });
				}
				return send(404, {
					ok: false,
					error: "not found: " + p
				});
			} catch (e) {
				return send(500, {
					ok: false,
					error: String(e?.message ?? e)
				});
			}
		}
	}), "manuscript-tracker: config api");
	const disposeTool = ctx.tools.register(defineTool({
		name: "check_manuscript_status",
		description: "检查配置的学术期刊投稿审稿状态（Editorial Manager 期刊确定性抓取；其他系统返回回退信号，请改用浏览器工具手动检查）。",
		parameters: { journal_name: {
			type: "string",
			description: "可选：只检查指定期刊名；缺省检查全部配置期刊。"
		} },
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: value
			}]
		},
		async execute(args) {
			const cfg = getConfigMerged();
			const journals = args.journal_name ? cfg.journals.filter((j) => j.name === args.journal_name) : cfg.journals;
			if (journals.length === 0) return "没有匹配的期刊配置。";
			return formatReport(await runCheck({
				...cfg,
				journals
			}, pcScrapeEnv(cfg)), (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), cfg.endedMonths);
		},
		presentCall: (args) => ({
			card: "generic",
			title: "检查投稿状态",
			kind: "read",
			rawInput: args.journal_name ?? ""
		})
	}));
	ctx.effect(() => disposeTool, "manuscript-tracker: tool");
	let lastRunDate = "";
	ctx.setInterval(() => {
		(async () => {
			const cfg = getConfigMerged();
			if (!cfg.scheduleEnabled || cfg.journals.length === 0) return;
			const { date, time } = nowInTz(cfg.timezone);
			if (lastRunDate !== date && tMin(time) >= tMin(cfg.time)) {
				lastRunDate = date;
				const dir = cfg.reportDir || defaultReportDir();
				log(dir, "定时检查开始 date=" + date + " time=" + time);
				const report = formatReport(await runCheck(cfg, pcScrapeEnv(cfg)), date, cfg.endedMonths);
				writeFileSync(join(dir, `report-${date}.md`), report, "utf8");
				writeFileSync(join(dir, "latest.md"), report, "utf8");
				if (cfg.serverchanKey) log(dir, "微信推送: " + (await pushServerChan(cfg.serverchanKey, `📊 投稿状态报告 (${date})`, report) ? "成功" : "失败"));
				if (cfg.reportSessionId) log(dir, "对话汇报: " + (await reportToSession(__pcAgentsRef || ctx.agents, __pcSessionsRef || ctx.sessions, cfg.reportSessionId, report)));
				log(dir, "定时检查完成");
			}
		})().catch((e) => log(cfg?.reportDir || defaultReportDir(), "定时检查异常: " + String(e)));
	}, 3e4);
	ctx.logger?.info?.("[@dsh-external/dsh-manuscript-tracker] 守护定时启动（每天 " + getConfigMerged().time + " " + getConfigMerged().timezone + "）");
}
//#endregion
export { Config, apply, inject, name };
