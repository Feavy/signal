import type Observer from "./Observer";

module ObserverStack {
  const dependencyStack: Observer[] = [];
  export function push(observer: Observer) {
    dependencyStack.push(observer);
  }

  export function pop(): Observer | undefined {
    return dependencyStack.pop();
  }

  export function current(): Observer | undefined {
    return dependencyStack[dependencyStack.length - 1];
  }
}

export default ObserverStack;
