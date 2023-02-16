import Signal from "./Signal";
import ObserverStack from "./ObserverStack";

export default class Observer {
  private readonly _callback: () => void;
  private readonly observedSignals = new Set<Signal<any>>();

  public constructor(callback: () => void) {
    this._callback = callback;
  }

  public observe(signal: Signal<any>) {
    this.observedSignals.add(signal);
  }

  public unobserve(signal: Signal<any>) {
    this.observedSignals.delete(signal);
  }

  public clearSignals() {
    this.observedSignals.clear();
  }

  public trigger() {
    ObserverStack.push(this);
    this.clearSignals();
    // When calling the callback, signals add themselves to the observer
    this._callback();
    ObserverStack.pop();
    for (const signal of this.observedSignals) {
      signal.removeDuplicatedObservers();
    }
  }
}

export type Observable<T> = T;

export function observe(callback: () => void) {
  const observer = new Observer(callback);
  observer.trigger();
  return observer;
}