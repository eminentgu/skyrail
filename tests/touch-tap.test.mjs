import {test} from 'node:test';import assert from 'node:assert/strict';
import {TouchTap} from '../apps/client/src/touch-tap.mjs';
test('phone tap tolerates normal finger jitter and emits a single atomic tap',()=>{const tap=new TouchTap(40,60);tap.move(48,66);assert.deepEqual(tap.end({x:.4,y:.6}),{kind:'tap',x:.4,y:.6,button:0,clickCount:1})});
test('moving away and returning does not accidentally click',()=>{const tap=new TouchTap(40,60);tap.move(80,60);tap.move(40,60);assert.equal(tap.end({x:.4,y:.6}),null)});
