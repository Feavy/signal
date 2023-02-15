import  { Reactor, Observer, hide, batch, shuck }  from 'reactorjs'

console.log("=== TestReactor ===");


const reactor = new Reactor({pos: {x: 0, y: 0}});
const observer = new Observer(() => {
  console.log('position is ', reactor.pos)
});
observer();
reactor.pos.x = 1;
