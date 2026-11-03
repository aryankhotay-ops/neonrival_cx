import {test} from 'node:test';
import {equal,ok} from 'node:assert/strict';
import {createInitialState,step,NEUTRAL,FIGHTERS,type FighterId} from '../src/index';
import {keyboardInput,PLAYER_KEYS} from '../../../apps/client/src/input/keyboard';
import {trainingComputerInput} from '../../../apps/client/src/input/trainingComputer';
test('every fighter locks standing or crouching normals until the move finishes',()=>{
 for(const id of Object.keys(FIGHTERS) as FighterId[])for(const attack of ['punch','kick'] as const)for(const down of [false,true]){
  let s=createInitialState([id,'ryu']);s=step(s,[{...NEUTRAL,down,[attack]:true},NEUTRAL]);
  const expected=down?(attack==='punch'?'crouchPunch':'crouchKick'):attack;
  equal(s.fighters[0].move,expected);equal(s.fighters[0].crouching,down);
  s=step(s,[{...NEUTRAL,down:!down},NEUTRAL]);equal(s.fighters[0].move,expected);equal(s.fighters[0].crouching,down);
  if(attack==='kick'){equal(FIGHTERS[id].moves[expected].height,down?'low':'high');equal(FIGHTERS[id].moves[expected].knockdown,down);}
 }
});
test('down alone crouches and stops movement, release stands up; airborne down does not select a sweep',()=>{
 let s=step(createInitialState(),[{...NEUTRAL,down:true,right:true},NEUTRAL]);equal(s.fighters[0].crouching,true);equal(s.fighters[0].vx,0);
 s=step(s,[NEUTRAL,NEUTRAL]);equal(s.fighters[0].crouching,false);
 s.fighters[0].y=3000;s=step(s,[{...NEUTRAL,down:true,kick:true},NEUTRAL]);equal(s.fighters[0].move,'kick');equal(s.fighters[0].crouching,false);
});
test('compact keyboard can drive both players simultaneously without overlapping bindings',()=>{
 const all=PLAYER_KEYS.flatMap(keys=>Object.values(keys));equal(new Set(all).size,16);
 const pressed=new Set(['KeyD','KeyG','ArrowLeft','KeyJ']);
 const a=keyboardInput(pressed,0),b=keyboardInput(pressed,1);ok(a.right&&a.kick&&!a.punch);ok(b.left&&b.punch&&!b.kick);
 const s=step(createInitialState(),[a,b]);equal(s.fighters[0].move,'kick');equal(s.fighters[1].move,'punch');
});
test('training computer closes the distance and lands attacks with any selected fighter',()=>{
 for(const id of Object.keys(FIGHTERS) as FighterId[]){let s=createInitialState(['ryu',id]);let hit=false;for(let i=0;i<900;i++){s=step(s,[NEUTRAL,trainingComputerInput(s)]);hit ||= s.events.some(e=>e.type==='hit'&&e.player===0);}ok(hit,`${id} must reach and attack the player`);equal(s.fighters[1].character,id);}
});
