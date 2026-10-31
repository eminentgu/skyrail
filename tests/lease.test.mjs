import{test}from'node:test';import assert from'node:assert/strict';import{transition}from'../packages/computer/lease.mjs';
test('concurrent takeover rejects stale epoch',()=>{const start={owner:'agent',epoch:8};const granted=transition(start,8,'human');assert.equal(granted.epoch,9);assert.throws(()=>transition(granted,8,'human'),e=>e.status===409)});
test('pause revokes owner; hand back increments epoch',()=>{const paused=transition({owner:'human',epoch:3},3,'none');assert.equal(paused.owner,'none');assert.equal(transition(paused,4,'agent').epoch,5)});
test('invalid owners cannot obtain a lease',()=>assert.throws(()=>transition({epoch:1},1,'admin'),e=>e.status===400));
