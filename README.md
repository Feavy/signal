# Signal

[![npm version](https://badge.fury.io/js/@feavy%2Fsignal.svg)](https://badge.fury.io/js/@feavy%2Fsignal)

*Still under development.*

***Signal*** is a lightweight library that allows to easily add reactivity to programs, so they can react to variable updates in real-time.  
Inspired by [reactor.js](https://github.com/fynyky/reactor.js/) and [solid](https://github.com/solidjs/solid), **Signal** is based on a system of signals and observers.

Here is a simple example of how to use it:

```ts
import Signal from '@feavy/signal/Signal';
import { observe } from '@feavy/signal/Observer';

interface Vec2 { x: number; y: number; }

const position: Signal<Vec2> = new Signal({x: 0, y: 0});

observe(() => {
  console.log("Position:", position.x, position.y);
}); // Prints: "Position: 0 0"

position.x = 10; // Prints: "Position: 10 0"
position.value = {x: 5, y :5}; // Prints: "Position: 0 0"
```

Each time `position` is modified, its observers are triggered.

- Signals are like normal objects, you can access their properties, or the value itself with the `value` attribute.
- When an observer accesses a signal, it is automatically registered.
- Observers are triggered when the modified properties are **exactly** the ones observed.

`Signal` is designed to be unobtrusive and offer a very simple API.

- Each variable can easily be replaced by a signal, especially class properties that can use getters and setters to modify the signal's value.
- ***TODO:*** There are several ways to observe signals.
- ***TODO:*** Signals can be chained to create complex behaviors.

It is important to know that a **signal** is not a **`stream`** : it is not possible to access previous values. So, for example, accumulation is not possible. A signal represent one value at a time.

However, streams may be added in a future version.

## Usage

### Declaring a Signal

Signals are the basis of this library and represent any variable you want to make observable.

For example, in a video game, you may want to make the health value observable.

You would write something like this:

```ts
const health = new Signal(20);
observe(() => {
  console.log("HP:", health.value);
});
```

The function will be called every time `health.value` is changed.

Inside a class it is more convenient to keep the signal private and only expose its `value` attribute:

```ts
class Entity {
  private readonly _health: Signal<number> = new Signal(20);

  public set health(health: number) { this._health.value = health; }
  public get health(): Observable<number> { return this._health.value; }
}

const entity = new Entity();

observe(() => {
  console.log("Entity HP:", entity.health);
});
```

In this way `entity.health` acts as a normal integer property, which can be observed.

### Object value

It is also possible to make an object observable.

For example:

```tsx
const position = new Signal({x: 0, y: 0});
```

Here **`position.value`** will be an object like :

```tsx
Signal<{
  x: Observable<number>,
  y: Observable<number>
}>
```

Also note that the signal acts as a proxy for every object property. So instead of writing **`position.value.x`**, you can simply write **`position.x`**, which will return the same value.

### Nested objects

In the case of nested objects, if you access an object attribute, you actually get a **signal** that matches the object’s interface:

```tsx
const state = new Signal({position: {x: 0, y: 0}, moving: false});
```

`state.value`:

```tsx
Signal<{
  position: Signal<{
    x: Observable<number>,
    y: Observable<number>
  }>,
  moving: Observable<boolean>
}>
```

You can use the utility property `state.value.unwrapped` to get the underlying object (not observable):

```tsx
{
  position: {
    x: number, 
    y: number
  },
  moving: boolean
}
```