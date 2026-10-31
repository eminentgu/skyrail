import {test} from 'node:test';import assert from 'node:assert/strict';
import {TouchGesture} from '../apps/client/src/touch-gesture.mjs';
const p={x:.4,y:.6};
test('touch tap sends one click only on finger-up',()=>{const g=new TouchGesture('scroll',40,60,p);assert.deepEqual(g.begin(),[]);assert.deepEqual(g.move(42,61,p),[]);assert.deepEqual(g.end(p).map(i=>i.kind),['down','up'])});
test('scroll never sends mouse down/up, even after returning to start',()=>{const g=new TouchGesture('scroll',40,60,p);assert.deepEqual(g.move(40,80,p),[{kind:'scroll',...p,deltaX:0,deltaY:-20}]);g.move(40,60,p);assert.deepEqual(g.end(p),[])});
test('explicit drag holds and releases the remote pointer',()=>{const g=new TouchGesture('drag',40,60,p);assert.equal(g.begin()[0].kind,'down');assert.equal(g.move(50,70,p)[0].kind,'move');assert.equal(g.end(p)[0].kind,'up')});
