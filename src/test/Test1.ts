import Signal from "../reactive/Signal";
import {observe} from "../reactive/Observer";

console.log("=== Test 1 ===");

const position = new Signal({x: 0, y: 0});
observe(() => {
  console.log("pos", position.value);
  // PB : on a des proxys
});
position.value = {x: 1, y: 1};
position.x = 2;

const health = new Signal(10);
observe(() => {
  console.log("health", health.value);
});
health.value = 20;