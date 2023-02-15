import dependencyStack from "./dependencyStack";
import type Observer from "./Observer";

/** TODO : séparer implémentation en PrimitiveSignal<T extends number | string | boolean | Function> et ObjectSignal<T extends object>
 * ObjectSignal possède des attributs : _properties (représentant l'objet) et _propertiesSignals
 * PrimitiveSignal possède un attribut : _value
 * Les deux sont conformes à une interface Signal<T> { value: T; }
 */

class SignalImpl<T> {
  private _signalValue: SignalValue<T>;
  private _value: T;
  private readonly _isValueObject: boolean;

  private readonly observers: Set<Observer> = new Set();

  private readonly _parent: SignalImpl<any> | null;

  constructor(initialValue: T, parent?: SignalImpl<any>) {
    this._parent = parent || null;
    this._isValueObject = typeof initialValue === 'object' && initialValue !== null;

    this._value = initialValue;

    if (this._isValueObject) {
      this._signalValue = objectToSignal(initialValue as any, this);

      return new Proxy(this, {
        get: (target: SignalImpl<T>, prop: string | symbol) => {
          const value = target._signalValue as any;
          if (prop in value) {
            return value[prop].value;
          }
          return (target as any)[prop];
        },
        set(target: SignalImpl<T>, prop: string | symbol, newValue: any, _: any): boolean {
          const signalValue = target._signalValue as any;
          const value = target._value as any;
          if (prop in signalValue) {
            value[prop] = newValue;
            const ret = signalValue[prop].value = newValue;
            // console.log("set child", prop, newValue);
            // for (const dependent of [...target.observers]) {
            //   dependent.trigger();
            // }
            return ret;
          }
          return (target as any)[prop] = newValue;
        }
      });
    } else {
      this.set(initialValue);

      return new Proxy(this, {
        apply(target: SignalImpl<T>, __: any, args: any[]): any {
          if (args.length === 0) return target.get();

          return target.set(args[0]);
        }
      });
    }
  }

  private _updated() {
    for (const dependent of [...this.observers]) {
      dependent.trigger();
    }
  }


  private removeSelf() {

  }

  public removeObserver(dependent: Observer) {
    this.observers.delete(dependent)
    if (this.observers.size === 0) this.removeSelf()
  }

  public get(): T {
    const dependent = dependencyStack[dependencyStack.length - 1];
    if (dependent) {
      this.observers.add(dependent);
      dependent.addSignal(this);
    }
    const output = this._value;

    if (output === null || (typeof output !== 'function' && typeof output !== 'object')) {
      return output as T;
    }

    return output as T;
  }

  public set(newValue: T, propagateToParents: boolean = true): T {
    // Avoid triggering observers if same value is written TODO : keep it?
    if (this._value === newValue) {
      return this._value;
    }

    if (this._isValueObject) {
      // TODO : update _value props values, bypass setter
      const signalValue = this._signalValue as SignalObject<any>;
      const value = this._value as any;
      for (const key in value) {
        value[key] = (newValue as any)[key];
      }
      for (const key in signalValue) {
        signalValue[key].set((newValue as any)[key], false);
      }
    } else {
      this._signalValue = newValue as SignalValue<T>;
      this._value = newValue;
    }

    for (const dependent of [...this.observers]) {
      dependent.trigger();
    }
    if(propagateToParents && this._parent) {
      this._parent._updated();
    }

    return newValue;
  }

  public get value(): T {
    return this.get();
  }

  public set value(newValue: T) {
    this.set(newValue);
  }
}

function objectToSignal<T extends object>(initialValue: T, parent: SignalImpl<T>): SignalValue<T> {
  const output: any = {};
  for (const key in initialValue) {
    if (initialValue.hasOwnProperty(key)) {
      const element = initialValue[key];
      output[key] = new SignalImpl(element, parent);
    }
  }
  return output;
}


type Signal<T> = T extends object ? SignalImpl<T> & T : SignalImpl<T>;
const Signal: new <T>(data: T) => Signal<T> = SignalImpl as any;
export default Signal;

type SignalValue<T> = T extends object ? SignalObject<T> : T;

type SignalObject<T> = {
  [Property in keyof T]: T[Property] extends Function ? T[Property] : T[Property] extends object ? SignalValue<T[Property]> : SignalImpl<T[Property]>;
}

export type Observable<T> = T extends object ? Signal<T> : T;

// type SignalNested<T> = SignalImpl<T> & {
//   [Property in keyof T]: T[Property] extends Function ? T[Property] : T[Property] extends string | number | symbol ? Observable<T[Property]> : SignalNested<T[Property]>;
// };