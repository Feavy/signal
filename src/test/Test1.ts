import Signal from "../reactive/Signal";
import {observe} from "../reactive/Observer";

// function unproxy<T extends object>(sig: Signal<T>): T {
//   const ret = {} as T;
//   for (const key in sig._value) {
//     const value = sig._value[key];
//     if (typeof value === "object" && value !== null) {
//       ret[key] = unproxy(value);
//     } else {
//       ret[key] = value;
//     }
//   }
//   return ret;
// }

console.log("=== Test 1 ===");

const state = new Signal({position: {x: "x_val", y: "y_val"}});
observe(() => {
  console.log("-> observer triggered", state.position);
});
state.position = {x: "1", y: "1"};
state.position.x = "2";

const health = new Signal(10);
observe(() => {
  console.log("health", health.value);
});
health.value = 20;