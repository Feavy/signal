import Observer from "./Observer";

module Batch {
  const observers: Set<Observer> = new Set();
  let batches: number = 0;

  export function add(observer: Observer) {
    observers.add(observer);
  }

  export function addAll(observers: Observer[]) {
    observers.forEach(observer => add(observer));
  }

  export function start() {
    batches++;
  }

  export function end() {
    batches--;
    if (batches <= 0) {
      batches = 0;
      observers.forEach(observer => observer.trigger());
      observers.clear();
    }
  }

  export function isBatching() {
    return batches > 0;
  }
}

export default Batch;

export function batch(callback: () => void) {
  Batch.start();
  callback();
  Batch.end();
}