import dependencyStack from "./dependencyStack";
import SignalImpl from "./Signal";

export default class Observer extends Function {
  private execute: Function;

  private awake = false;

  private signals = new Set<SignalImpl<any>>();

  private value = new SignalImpl<any>(undefined);

  private thisContext: any;
  private argsContext: any[] = [];

  public clearDependencies () {
    if (this.signals === null) return;

    this.signals.forEach(dependency => {
      dependency.removeObserver(this);
    });

    this.signals = new Set();
  }

  public addSignal (dependency: SignalImpl<any>) {
    this.signals.add(dependency);
  }

  public trigger () {
    if (this.awake) {
      this.clearDependencies();

      dependencyStack.push(this);
      if(dependencyStack.length > 20) {
        throw new Error('Dependency stack overflow. You may be modifying a signal inside of an observer.');
      }

      let result;

      try {
        result = this.execute.apply(this.thisContext, this.argsContext);
      } finally {
        dependencyStack.pop();
      }

      this.value = result;
      return true;
    }
    return false;
  };

  public stop () {
    if (!this.awake) return false;
    this.awake = false;
    this.clearDependencies();
    return true;
  }

  public start () {
    if (this.awake) return false;
    this.awake = true;
    this.trigger();
    return true;
  }

  constructor (execute: Function) {
    super();
    // Parameter validation
    if (typeof execute !== 'function') {
      throw new TypeError('Cannot create observer with a non-function.');
    }

    this.execute = execute;

    const self = this;

    return new Proxy(this, {
      apply(_, thisArg, args) {
        self.thisContext = thisArg;
        self.argsContext = args;
        self.awake = true;
        self.trigger();
        return self.value;
      },
      construct(_1, args, _2) {
        return Reflect.construct(self.execute, args);
      }
    });
  }
}

export function observe(prop: string): number;
export function observe(prop: number): string;
export function observe(prop: Function): string;
export function observe(func: Function|string|number): any {
  new Observer(func as any)();
}
