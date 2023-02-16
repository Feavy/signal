import Signal from "../reactive/Signal";
import {observe} from "../reactive/Observer";

console.log("=== Test 1 ===");

class Entity {
  private readonly _position = new Signal({x: 0, y: 0});
  public get position() {
    return this._position.value;
  }
  public set position(newValue) {
    this._position.value = newValue;
  }
}

const entity = new Entity();

observe(() => {
  console.log("-> observer triggered", entity.position.unwrapped);
});

entity.position.x = 1;
entity.position.y = 2;
entity.position = {x: 3, y: 4};

// const state = new Signal({position: {x: "x_val", y: "y_val"}});
// observe(() => {
//   console.log("-> observer triggered", state.position.value!.x);
// });
// state.debug();
// state.position = {x: "1", y: "1"};
// state.position.y = "2";
