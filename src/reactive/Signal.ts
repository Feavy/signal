import Observer from "./Observer";
import ObserverStack from "./ObserverStack";
import {Batch} from "./batch";

const debug = (...args: any[]) => {}; // console.log;

abstract class AbstractSignal<T> {
  protected _value: T;
  protected _parent?: NodeSignal<any>;
  private observers: Observer[] = [];

  protected constructor(initialValue: T, parent?: NodeSignal<any>) {
    this._value = initialValue;
    this._parent = parent;
  }

  public abstract set value(newValue: T);
  public abstract get value(): T;

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
  private readonly _proxy;

  public constructor(initialValue: T, parent?: NodeSignal<any>) {
    super(initialValue, parent);

    for (const key in initialValue) {
      const value = initialValue[key];
      this._properties.set(key, new NodeOrLeafSignal(value, this));
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
        return (target as any)[prop];
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

    const newBatch = !Batch.isBatching();

    // Only start a new batch if we are not already batching (in case of nested signals)
    if (newBatch) Batch.start();

    for (const key in newValue) {
      const value = newValue[key];
      this._value[key] = value;
      this._properties.get(key)!.value = value;
    }

    if (newBatch) Batch.end();
  }

  public get value(): T & {unwrapped?: T} {
    debug("get this value", this._value);

    const observer = ObserverStack.current();
    if (observer) {
      this.removeParentObserver(observer);
      this.addObserver(observer);
    }
    debug("this", this);
    return this._proxy as unknown as T & {unwrapped?: T};
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