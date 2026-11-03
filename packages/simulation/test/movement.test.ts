import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createInitialState, step, NEUTRAL, GROUND, type FighterId, type Input } from '../src/index';
import { advanceAnimation, movementAction } from '../../../apps/client/src/render/movementAnimation';

const fighters:FighterId[]=['kai','vex','ryu','ken','dudley'];
const input=(change:Partial<Input>={}):Input=>({...NEUTRAL,...change});
for(const fighter of fighters){
 test(`${fighter} moves forward and backward while facing the opponent on either side`,()=>{
  for(const side of [0,1] as const){
   let s=createInitialState(side===0?[fighter,'ryu']:['ryu',fighter]);
   const forward=side===0?input({right:true}):input({left:true});
   const backward=side===0?input({left:true}):input({right:true});
   const start=s.fighters[side].x;for(let n=0;n<8;n++)s=step(s,side===0?[forward,input()]:[input(),forward]);
   const p=s.fighters[side];assert.equal(p.facing,side===0?1:-1);assert.equal(movementAction(p.vx,p.facing),'walk');assert.ok(side===0?p.x>start:p.x<start);
   const middle=p.x;for(let n=0;n<8;n++)s=step(s,side===0?[backward,input()]:[input(),backward]);
   const after=s.fighters[side];assert.equal(after.facing,side===0?1:-1);assert.equal(movementAction(after.vx,after.facing),'back');assert.ok(side===0?after.x<middle:after.x>middle);
   s=step(s,side===0?[input({up:true}),input()]:[input(),input({up:true})]);assert.ok(s.fighters[side].y<GROUND);
   for(let n=0;n<65;n++)s=step(s);assert.equal(s.fighters[side].y,GROUND);
  }
 });
}
test('movement animation restarts on action changes and advances only with game frames',()=>{
 let c=advanceAnimation(null,'idle','dudley',100);c=advanceAnimation(c,'idle','dudley',105);assert.equal(c.elapsed,5);
 c=advanceAnimation(c,'walk','dudley',105);assert.equal(c.elapsed,0);c=advanceAnimation(c,'walk','dudley',105);assert.equal(c.elapsed,0);
 c=advanceAnimation(c,'walk','dudley',110);assert.equal(c.elapsed,5);c=advanceAnimation(c,'back','dudley',111);assert.equal(c.elapsed,0);
 c=advanceAnimation(c,'back','ryu',112);assert.equal(c.elapsed,0);c=advanceAnimation(c,'back','ryu',5);assert.equal(c.elapsed,0);
 c=advanceAnimation(c,'back','ryu',100);assert.equal(c.elapsed,8);
});
test('Dudley walking and retreating do not include the reversed poses',()=>{
 const data=JSON.parse(readFileSync(new URL('../../../apps/client/public/assets/sf3/dudley-animations.json',import.meta.url),'utf8')) as {actions:Record<string,{key:string}[]>};
 for(const action of ['walk','back']){assert.ok(data.actions[action].length>1);for(const f of data.actions[action])assert.ok(!['250-3','250-4'].includes(f.key),`${action} includes reversed pose ${f.key}`);}
});
