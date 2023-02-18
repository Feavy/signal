import Observer from "./Observer";

export module Batch {
  const observers: Set<Observer> = new Set();
  let _batches: number = 0;

  export function add(observer: Observer) {
    observers.add(observer);
  }

  export function addAll(observers: Observer[]) {
    observers.forEach(observer => add(observer));
  }

  export function start() {
    _batches++;
  }

  export function end() {
    _batches--;
    if(_batches <= 0) {
      _batches = 0;
      observers.forEach(observer => observer.trigger());
      observers.clear();
    }
  }

  export function isBatching() {
    return _batches > 0;
  }
}

export default function batch(callback: () => void) {
  Batch.start();
  callback();
  Batch.end();
}