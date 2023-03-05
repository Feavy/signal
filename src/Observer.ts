import {Signal} from "./Signal";
import ObserverStack from "./ObserverStack";

export default class Observer {
  private initialized: boolean = false;
  private readonly _callback: () => void;
  private readonly observedSignals = new Map<Signal<any>, number>();

  public constructor(callback: () => void) {
    this._callback = callback;
  }

  public observe(signal: Signal<any>) {
    const previous = this.observedSignals.get(signal) || 0
    this.observedSignals.set(signal, previous + 1);
  }

  public unobserve(signal: Signal<any>) {
    this.observedSignals.delete(signal);
  }

  public clearSignals() {
    this.observedSignals.clear();
  }

  public trigger() {
    if(this.initialized) {
      this._callback();
      return;
    }
    ObserverStack.push(this);
    this.clearSignals();
    // When calling the callback, signals add themselves to the observer
    this._callback();
    for (const signal of [...this.observedSignals.keys()]) {
      signal.removeDuplicatedObservers();
    }
    let leafs = [...this.observedSignals.entries()].filter(([signal, value]) => {
      return [...signal._children.values()].length === 0
              || [...signal._children.values()].every(signal => (this.observedSignals.get(signal) || 0) < value);
    }).map(([signal, _]) => signal);

    for(const signal of leafs) {
      signal.observeAll();
    }
    ObserverStack.pop();
    this.initialized = true;
  }
}

export type Observable<T> = T;

export function observe(callback: () => void) {
  const observer = new Observer(callback);
  observer.trigger();
  return observer;
}