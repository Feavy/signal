import Signal from "../reactive/Signal";
import {observe} from "../reactive/Observer";

console.log("=== Test 1 ===");

class Entity {
  public position = new Signal({x: 0, y: 0});
}

const entity = new Entity();

observe(() => {
  console.log("-> observer triggered", entity.position.value.x);
});

entity.position.debug()
entity.position.x = 1;

// const state = new Signal({position: {x: "x_val", y: "y_val"}});
// observe(() => {
//   console.log("-> observer triggered", state.position.value!.x);
// });
// state.debug();
// state.position = {x: "1", y: "1"};
// state.position.y = "2";
