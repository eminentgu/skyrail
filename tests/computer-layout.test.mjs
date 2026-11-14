import {test} from 'node:test';
import assert from 'node:assert/strict';
import {windowLimits,fitWindow,resizeWindow,fitSidebar} from '../apps/client/src/computer-layout.mjs';

test('desktop floating windows keep navigation accessible and fit both size bounds',()=>{
 const l=windowLimits({width:1440,height:900},56,true);
 const r=fitWindow({left:9999,top:-100,width:9999,height:9999},l);
 assert.equal(r.width,1120);assert.equal(r.height,828);
 assert.ok(r.top>=64);assert.ok(r.left+r.width<=1432);assert.ok(r.top+r.height<=892);
 const small=resizeWindow(r,-9999,-9999,l);
 assert.equal(small.width,360);assert.equal(small.height,260);
});
test('phone window width and height can change while every edge remains reachable',()=>{
 const l=windowLimits({width:390,height:760},48,false);
 const r=fitWindow({left:12,top:72,width:366,height:350},l);
 const large=resizeWindow(r,9999,9999,l);
 assert.equal(large.left,r.left);assert.equal(large.top,r.top);
 assert.ok(large.left+large.width<=382);assert.ok(large.top+large.height<=752);
 const small=resizeWindow(large,-9999,-9999,l);
 assert.equal(small.width,220);assert.equal(small.height,160);
});
test('keyboard and rotation constrain an existing window without losing its title or resize handle',()=>{
 const l=windowLimits({width:360,height:200,top:100},48,false);
 const r=fitWindow({left:330,top:500,width:600,height:700},l);
 assert.ok(r.left>=8);assert.ok(r.top>=108);
 assert.ok(r.left+r.width<=352);assert.ok(r.top+r.height<=292);
 const tiny=fitWindow(r,windowLimits({width:240,height:130},48,false));
 assert.ok(tiny.width<=224);assert.ok(tiny.top+tiny.height<=122);
});
test('sidebar reserves usable conversation space, respects limits and survives narrow desktop widths',()=>{
 assert.equal(fitSidebar(9999,1200),880);
 assert.equal(fitSidebar(1,1200),320);
 assert.equal(fitSidebar(440,652),356);
 assert.ok(652-fitSidebar(9999,652)>=296);
 assert.equal(fitSidebar(NaN,1200),320);
});
test('invalid or stale saved floating dimensions are constrained before use',()=>{
 const l=windowLimits({width:390,height:760},48,false);
 const r=fitWindow({left:NaN,top:Infinity,width:NaN,height:-1},l);
 assert.equal(r.left,8);assert.equal(r.top,56);assert.equal(r.width,220);assert.equal(r.height,160);
});
