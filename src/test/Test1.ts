import Signal from "../reactive/Signal";
import {observe} from "../reactive/Observer";

console.log("=== Test 1 ===");

const state = new Signal({position: {x: "x_val", y: "y_val"}});
observe(() => {
  console.log("-> observer triggered", state.position.value);
});
state.debug();
state.position = {x: "1", y: "1"};
state.position.y = "2";

const health = new Signal(10);
observe(() => {
  console.log("health", health.value);
});
health.value = 20;