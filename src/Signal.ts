import Observer from "./Observer";
import ObserverStack from "./ObserverStack";
import Batch from "./Batch";

function getMethods<T>(obj: T): (keyof T)[] {
  let properties = new Set()
  let currentObj = obj
  do {
    Object.getOwnPropertyNames(currentObj).map(item => properties.add(item))
  } while ((currentObj = Object.getPrototypeOf(currentObj)) && Object.getPrototypeOf(currentObj))
  return [...properties.keys()].filter(item => typeof obj[item as (keyof T)] === 'function' && item !== "constructor") as (keyof T)[]
}

let debug = (..._: any[]) => {};

export class Signal<T> {
  private _value: T;
  public readonly _children: Map<string, Signal<any>> = new Map();
  private _observers: Observer[] = [];

  public constructor(value: T, public readonly name: string, public readonly _parent?: Signal<any>) {
    this._value = value;
  }

  protected addObserver(observer: Observer) {
    this._observers.push(observer);
    observer.observe(this);
    debug("children", [...this._children.keys()])
    for (const signal of this._children.values()) {
      signal.addObserver(observer);
    }
  }

  protected removeParentObserver(observer: Observer) {
    if (this._parent) {
      this._parent.removeObserver(observer);
    }
  }

  protected removeObserver(observer: Observer) {
    const index = this._observers.indexOf(observer);
    if (index !== -1) {
      this._observers.splice(index, 1);
    }
    for (const signal of this._children.values()) {
      signal.removeObserver(observer);
    }
  }

  public removeDuplicatedObservers() {
    this._observers = [...new Set(this._observers)];
  }

  protected triggerObservers() {
    if (Batch.isBatching()) {
      Batch.addAll(this._observers);
    } else {
      this._observers.forEach(observer => observer.trigger());
    }
  }

  public addChild(name: string, signal: Signal<any>) {
    this._children.set(name, signal);
    debug("add child", name, "to", this.name);
  }

  public get value(): T {
    debug("get value", this.name);

    const observer = ObserverStack.current();
    if (observer) {
      debug("  observed by", observer);
      // this.removeParentObserver(observer); TODO
      this.addObserver(observer);
    }

    return this._value;
  }

  public set value(newValue: T) {
    debug("set value", this.name);
    if (typeof this._value === "object" && typeof newValue === "object") {
      if (this._value == null || newValue == null) {
        return;
      }

      Batch.start();
      /*
      TODO : there are two possibilities here:
      1. Keeping the same object reference, but updating its properties (the current implementation)
         Not the classical behavior, but it's more the reactive way to keep the same reference I think
      2. Replacing the object with the new value
         Needs to signalify the properties of the new value that were observed in the past one
         and move the observers from the old signals to the new ones
       */
      for (const key in newValue) {
        this._value[key] = newValue[key];
      }
      Batch.end();
    } else {
      this._value = newValue;
      this.triggerObservers();
    }
  }

  public observeAll() {
    if(!(typeof this._value === "object")) {
      return;
    }

    for(const key in this._value) {
      this._value[key]; // call getter
      const signal = this._children.get(key);
      if(!signal) {
        throw new Error("Signal not found for " + key);
      }
      signal.observeAll();
    }
  }

  public static setDebug(enabled: boolean) {
    if(enabled) {
      debug = console.log;
    } else {
      debug = () => {};
    }
  }
}

export default function signalify<T>(value: T, name: string = "root", parent?: Signal<any>): Signalified<T> {
  if (typeof value === "object") {
    return signalifyObject(value as any, name, parent) as Signalified<T>;
  } else {
    return signalifyValue(value as any, name, parent) as Signalified<T>;
  }
}

function signalifyObject<T extends object>(value: T, name: string, parent?: Signal<any>): Signalified<T> {
  // TODO: check if value is already signalified
  const thisSignal = new Signal(value, name, parent);

  for (const key in value) {
    let prop = value[key];
    let signal: Signal<any>;

    Object.defineProperty(value, key, {
      get() {
        if (!signal) {
          if(!ObserverStack.current()) {
            return prop;
          }
          signal = signalify(prop, key, thisSignal)._signal;
          thisSignal.addChild(key, signal);
        }
        return signal.value;
      },
      set(newValue) {
        if (!signal) {
          prop = newValue;
        } else {
          signal.value = newValue;
        }
      }
    });
  }

  // Enable batching between all method calls
  // TODO : Do not update methods that have already been replaced
  for(const method of getMethods(value)) {
    console.log("method", method)
    const original = (value[method] as (...args: any[]) => any).bind(value);
    const replacement = (...args: any[]) => {
      Batch.start();
      const result = original.apply(value, args);
      Batch.end();
      return result;
    }

    Object.defineProperty(value, method, {
      value: replacement
    });
  }

  Object.defineProperty(value, "_signal", {
    value: thisSignal
  });

  return value as Signalified<T>;
}

function signalifyValue<T extends number | boolean | string | Function | bigint>(value: T, name: string, parent?: Signal<any>): Signalified<T> {
  const signal = new Signal(value, name, parent);
  const obj = {
    _signal: signal
  };
  return obj as Signalified<T>;
}

function isSignalified(value: any): value is Signalified<any> {
  return "_signal" in value;
}

type Signalified<T> = T extends object ? T & {
  _signal: Signal<T>;
} : {
  _signal: Signal<T>;
};
