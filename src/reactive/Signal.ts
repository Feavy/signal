import Observer from "./Observer";
import ObserverStack from "./ObserverStack";
import {batch, Batch} from "./batch";

abstract class AbstractSignal<T> {
  protected _value: T;
  protected _parent?: SignalNode<any>;
  private observers: Observer[] = [];

  protected constructor(initialValue: T, parent?: SignalNode<any>) {
    this._value = initialValue;
    this._parent = parent;
  }

  protected abstract debug(indent: string): void;

  public abstract set value(newValue: T);
  public abstract get value(): T;

  protected addObserver(observer: Observer) {
    this.observers.push(observer);
    observer.observe(this);
  }

  protected removeParentObserver(observer: Observer) {
    if (this._parent) {
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
}

class SignalNode<T extends object> extends AbstractSignal<T> {
  private readonly _properties: Map<keyof T, Signal<any>> = new Map();

  public constructor(initialValue: T, parent?: SignalNode<any>) {
    super(initialValue, parent);

    for (const key in initialValue) {
      const value = initialValue[key];
      this._properties.set(key, new NodeOrLeafSignal(value, this));
    }

    return new Proxy(this, {
      get: (target: SignalNode<T>, prop: string | symbol) => {
        const signal = target._properties.get(prop as keyof T);
        if (signal instanceof SignalNode) {
          console.log("get", prop);
          signal.value;
          return signal;
        } else if (signal instanceof SignalLeaf) {
          console.log("get", prop);
          return signal!.value;
        }
        return (target as any)[prop];
      },
      set(target: SignalNode<T>, prop: string | symbol, newValue: any, _: any): boolean {
        const signal = target._properties.get(prop as keyof T);
        const value = target._value as any;
        if (signal) {
          console.log("set", prop, newValue);
          value[prop] = newValue;
          return signal.value = newValue;
        }
        return (target as any)[prop] = newValue;
      }
    })
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
    console.log("set this value", newValue);

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

  public get value(): T {
    const observer = ObserverStack.current();
    if (observer) {
      this.removeParentObserver(observer);
      this.addObserver(observer);
    }
    return this._value;
  }

  protected debug(indent: string = "") {
    console.log(indent + "value: ", this._value);
    console.log(indent + "observers: ", this.observers.length);
    for (const [key, signal] of this._properties) {
      console.log(indent + " " + (key as string) + " :");
      signal.debug(indent + "  ");
    }
  }
}

class SignalLeaf<T extends number | string | boolean | Function> extends AbstractSignal<T> {
  public constructor(initialValue: T, parent?: SignalNode<any>) {
    super(initialValue, parent);
  }

  public get value(): T {
    const observer = ObserverStack.current();
    if (observer) {
      this.addObserver(observer);
      this.removeParentObserver(observer);
    }
    return this._value;
  }

  public set value(newValue: T) {
    console.log("set this value", newValue);
    this._value = newValue;
    this.triggerObservers();
  }

  protected debug(indent: string = "") {
    console.log(indent + "value: " + this._value);
    console.log(indent + "observers: ", this.observers.length);
  }
}

class NodeOrLeafSignal<T> extends AbstractSignal<T> {
  public constructor(initialValue: T, parent?: SignalNode<any>) {
    super(initialValue, parent);
    if (typeof initialValue === 'object' && initialValue !== null) {
      //@ts-ignore
      return new SignalNode(initialValue, parent);
    } else {
      //@ts-ignore
      return new SignalLeaf(initialValue, parent);
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
    : T extends number | string | boolean | Function ? SignalLeaf<T>
        : unknown;

type NestedSignal<T> = T extends object ? SignalNode<T> & { [K in keyof T]: T[K] & {value?: T[K]} }
    : T extends number | string | boolean | Function ? T
        : unknown;

const Signal: new <T>(data: T) => Signal<T> = NodeOrLeafSignal as any;
export default Signal;