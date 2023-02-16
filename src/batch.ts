import Observer from "./Observer";

export module Batch {
  const observers: Set<Observer> = new Set();
  let _isBatching = false;

  export function add(observer: Observer) {
    observers.add(observer);
  }

  export function addAll(observers: Observer[]) {
    observers.forEach(observer => add(observer));
  }

  export function start() {
    _isBatching = true;
  }

  export function end() {
    _isBatching = false;
    observers.forEach(observer => observer.trigger());
    observers.clear();
  }

  export function isBatching() {
    return _isBatching;
  }
}

export default function batch(callback: () => void) {
  Batch.start();
  callback();
  Batch.end();
}