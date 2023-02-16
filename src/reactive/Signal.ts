import Observer from "./Observer";
import ObserverStack from "./ObserverStack";

abstract class AbstractSignal<T> {
  protected _value: T;
  protected _parent?: SignalNode<any>;
  private observers: Observer[] = [];

  protected constructor(initialValue: T, parent?: SignalNode<any>) {
    this._value = initialValue;
    this._parent = parent;
  }

  public abstract set value(newValue: T);
  public abstract get value(): T;

  protected addObserver(observer: Observer) {
    this.observers.push(observer);
  }

  protected removeParentObserver(observer: Observer) {
    if (this._parent) {
      this._parent.removeObserver(observer);
    }
  }

  protected removeObserver(observer: Observer) {
    this.observers = this.observers.filter(o => o !== observer);
  }

  public removeDuplicatedObservers() {
    this.observers = [...new Set(this.observers)];
  }

  protected triggerObservers() {
    this.observers.forEach(observer => observer.trigger());
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
          return signal;
        }else if(signal instanceof SignalLeaf) {
          return signal!.value;
        }
        return (target as any)[prop];
      },
      set(target: SignalNode<T>, prop: string | symbol, newValue: any, _: any): boolean {
        const signal = target._properties.get(prop as keyof T);
        const value = target._value as any;
        if (signal) {
          value[prop] = newValue;
          return signal.value = newValue;
        }
        return (target as any)[prop] = newValue;
      }
    })
  }

  public set value(newValue: T) {
    for(const key in newValue) {
      const value = newValue[key];
      this._properties.get(key)!.value = value;
    }
    this.triggerObservers();
  }

  public get value(): T {
    const observer = ObserverStack.current();
    if (observer) {
      this.addObserver(observer);
      observer.observe(this);
      this.removeParentObserver(observer);
    }
    return this._value;
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
      observer.observe(this);
      this.removeParentObserver(observer);
    }
    return this._value;
  }

  public set value(newValue: T) {
    this._value = newValue;
    this.triggerObservers();
  }
}

class NodeOrLeafSignal<T> extends AbstractSignal<T> {
  public constructor(initialValue: T, parent?: SignalNode<any>) {
    super(initialValue, parent);
    if(typeof initialValue === 'object' && initialValue !== null) {
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

type Signal<T> =  T extends object ? SignalNode<T> & T
                : T extends number | string | boolean | Function ? SignalLeaf<T>
                : unknown;

const Signal: new <T>(data: T) => Signal<T> = NodeOrLeafSignal as any;
export default Signal;