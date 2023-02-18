import Observer, {Observable} from "./Observer";
import ObserverStack from "./ObserverStack";
import {Batch} from "./batch";

const debug = (..._: any[]) => {}; // console.log;

function getMethods<T>(obj: T): (keyof T)[] {
  let properties = new Set()
  let currentObj = obj
  do {
    Object.getOwnPropertyNames(currentObj).map(item => properties.add(item))
  } while ((currentObj = Object.getPrototypeOf(currentObj)) && Object.getPrototypeOf(currentObj))
  return [...properties.keys()].filter(item => typeof obj[item as (keyof T)] === 'function' && item !== "constructor") as (keyof T)[]
}

abstract class AbstractSignal<T> {
  protected _value: T;
  protected _parent?: NodeSignal<any>;
  private observers: Observer[] = [];

  protected constructor(initialValue: T, parent?: NodeSignal<any>) {
    this._value = initialValue;
    this._parent = parent;
  }

  public abstract set value(newValue: T);
  public abstract get value(): Observable<T>;

  protected addObserver(observer: Observer) {
    this.observers.push(observer);
    observer.observe(this);
  }

  protected removeParentObserver(observer: Observer) {
    if (this._parent) {
      //@ts-ignore
      this._parent.removeObserver(observer);
    }
  }

  protected removeObserver(observer: Observer) {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
    }
  }

  public removeDuplicatedObservers() {
    this.observers = [...new Set(this.observers)];
  }

  protected triggerObservers() {
    if (Batch.isBatching()) {
      Batch.addAll(this.observers);
    } else {
      this.observers.forEach(observer => observer.trigger());
    }
  }

  public debug(indent: string) {
    console.log(indent + "value: ", this._value);
    console.log(indent + "observers: ", this.observers.length);
  }
}

class NodeSignal<T extends object> extends AbstractSignal<T> {
  private readonly _properties: Map<keyof T, Signal<any>> = new Map();
  private readonly _methods: Map<keyof T, (...args: any[]) => any> = new Map();
  private readonly _proxy;

  public constructor(initialValue: T, parent?: NodeSignal<any>) {
    super(initialValue, parent);

    for (const key in initialValue) {
      const value = initialValue[key];
      this._properties.set(key, new NodeOrLeafSignal(value, this));
    }

    for(const method of getMethods(initialValue)) {
      const original = initialValue[method] as (...args: any[]) => any;
      this._methods.set(method, (...args: any[]) => {
        Batch.start();
        const result = original.apply(this._proxy, args);
        Batch.end();
        return result;
      });
    }

    this._proxy = new Proxy(this, {
      get: (target: NodeSignal<T>, prop: string | symbol) => {
        const signal = target._properties.get(prop as keyof T);
        if (signal instanceof NodeSignal) {
          debug("get node prop", prop);
          signal.value;
          return signal;
        } else if (signal instanceof LeafSignal) {
          debug("get leaf prop", prop);
          return signal!.value;
        }
        const method = target._methods.get(prop as keyof T);
        if(method) {
          return method;
        }
        return (target as any)[prop] || (initialValue as any)[prop];
      },
      set(target: NodeSignal<T>, prop: string | symbol, newValue: any, _: any): boolean {
        const signal = target._properties.get(prop as keyof T);
        const value = target._value as any;
        if (signal) {
          debug("set", prop, newValue);
          value[prop] = newValue;
          return signal.value = newValue;
        }
        return (target as any)[prop] = newValue;
      }
    });
    return this._proxy;
  }

  protected addObserver(observer: Observer) {
    super.addObserver(observer);
    observer.observe(this);
    for (const signal of this._properties.values()) {
      signal.addObserver(observer);
    }
  }

  protected removeObserver(observer: Observer) {
    super.removeObserver(observer);
    for (const signal of this._properties.values()) {
      signal.removeObserver(observer);
    }
  }

  public set value(newValue: T) {
    debug("set this value", newValue);

    const observer = ObserverStack.current();
    if (observer) {
      console.warn("Cannot reassign observed signal inside observer");
      this.removeObserver(observer);
    }

    Batch.start();

    for (const key in newValue) {
      const value = newValue[key];
      this._value[key] = value;
      this._properties.get(key)!.value = value;
    }

    Batch.end();
  }

  public get value(): T & { unwrapped?: T } {
    debug("get this value", this._value);

    const observer = ObserverStack.current();
    if (observer) {
      this.removeParentObserver(observer);
      this.addObserver(observer);
    }
    debug("this", this);
    return this._proxy as unknown as T & { unwrapped?: T };
  }

  public get unwrapped() {
    this.value;
    return this._value;
  }

  public debug(indent: string = "") {
    super.debug(indent);
    for (const [key, signal] of this._properties) {
      console.log(indent + " " + (key as string) + " :");
      signal.debug(indent + "  ");
    }
  }

  public static signalify<T extends object>(object: T): NestedSignal<T> {
    const rootSignal = new NodeSignal(object);
    Object.defineProperty(object, 'value', {
      get: () => rootSignal.value,
      set: (newValue: T) => rootSignal.value = newValue
    });
    for (const key in object) {
      const value = object[key];
      if(typeof value === 'function') {
        continue;
      }
      Object.defineProperty(object, "_" + key, {
        value: value,
        writable: true
      });
      delete object[key];
      const signal = rootSignal._properties.get(key);
      Object.defineProperty(object, key, {
        get: () => signal.value,
        set: (newValue) => {
          //@ts-ignore
          object["_" + key] = newValue;
          signal.value = newValue
        }
      });
    }
    for(const method of getMethods(object)) {
      const methodSignal = rootSignal._methods.get(method);
      Object.defineProperty(object, method, {
        value: methodSignal
      });
    }
    return object as NestedSignal<T>;
  }
}

class LeafSignal<T extends number | string | boolean | Function> extends AbstractSignal<T> {
  public constructor(initialValue: T, parent?: NodeSignal<any>) {
    super(initialValue, parent);
  }

  public get value(): T {
    const observer = ObserverStack.current();
    if (observer) {
      this.removeParentObserver(observer);
      this.addObserver(observer);
    }
    return this._value;
  }

  public set value(newValue: T) {
    debug("set this value", newValue);

    const observer = ObserverStack.current();
    if (observer) {
      console.warn("Cannot reassign observed signal inside observer");
      this.removeObserver(observer);
    }

    this._value = newValue;
    this.triggerObservers();
  }
}

class NodeOrLeafSignal<T> extends AbstractSignal<T> {
  public constructor(initialValue: T, parent?: NodeSignal<any>) {
    super(initialValue, parent);
    if (typeof initialValue === 'object' && initialValue !== null) {
      //@ts-ignore
      return new NodeSignal(initialValue, parent);
    } else {
      //@ts-ignore
      return new LeafSignal(initialValue, parent);
    }
  }

  public get value(): T {
    throw new Error("Method not implemented.");
  }

  public set value(_: T) {
    throw new Error("Method not implemented.");
  }
}

type Signal<T> = T extends object ? NestedSignal<T>
    : T extends number | string | boolean | Function ? LeafSignal<T>
        : unknown;

type NestedSignal<T> = T extends object ? NodeSignal<T> & { [K in keyof T]: T[K] & { value?: T[K] } }
    : T extends number | string | boolean | Function ? T
        : unknown;

const Signal: new <T>(data: T) => Signal<T> = NodeOrLeafSignal as any;
export default Signal;

export function signalify<T extends object>(object: T): NestedSignal<T> {
  return NodeSignal.signalify(object);
}