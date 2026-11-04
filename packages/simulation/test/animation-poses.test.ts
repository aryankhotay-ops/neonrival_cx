import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {FIGHTERS,NEUTRAL,createInitialState,step,type FighterId,type MoveName} from '../src/index';
import {attackAnimationFrame,type AnimationData} from '../../../apps/client/src/render/attackAnimation';

const ids=Object.keys(FIGHTERS) as FighterId[];
const load=(id:FighterId)=>JSON.parse(readFileSync(new URL(`../../../apps/client/public/assets/sf3/${FIGHTERS[id].appearance}-animations.json`,import.meta.url),'utf8')) as AnimationData;
for(const id of ids){
 test(`${id}: standing/crouching buttons reach their own contact poses on active hit frames`,()=>{
  const data=load(id);
  for(const side of [0,1] as const)for(const button of ['punch','kick'] as const)for(const down of [false,true]){
   let state=createInitialState(side===0?[id,'ryu']:['ryu',id]);
   const input={...NEUTRAL,down,[button]:true};state=step(state,side===0?[input,NEUTRAL]:[NEUTRAL,input]);
   const expected:MoveName=down?(button==='punch'?'crouchPunch':'crouchKick'):button;
   assert.equal(state.fighters[side].move,expected);
   const timing=FIGHTERS[id].moves[expected],phases=data.attackPhases![expected]!;
   while(state.fighters[side].moveFrame<timing.startup)state=step(state);
   const p=state.fighters[side];assert.equal(p.move,expected);
   assert.ok(phases.active.some(key=>data.frames[key]===attackAnimationFrame(data,expected,timing,p.moveFrame)));
   assert.equal(p.facing,side===0?1:-1);
  }
 });
 test(`${id}: all six attacks keep contact art inside the active window and recover to a valid pose`,()=>{
  const data=load(id);
  for(const move of Object.keys(FIGHTERS[id].moves) as MoveName[]){
   const timing=FIGHTERS[id].moves[move],phases=data.attackPhases![move]!;
   assert.ok(phases.startup.length&&phases.active.length&&phases.recovery.length);
   for(let frame=0;frame<timing.startup+timing.active+timing.recovery;frame++){
    const expected=frame<timing.startup?phases.startup:frame<timing.startup+timing.active?phases.active:phases.recovery;
    const n=attackAnimationFrame(data,move,timing,frame);assert.ok(Number.isInteger(n));assert.ok(expected.some(key=>data.frames[key]===n),`${move} frame ${frame}`);
   }
  }
  assert.notDeepEqual(data.attackPhases!.punch!.active,data.attackPhases!.kick!.active);
  assert.notDeepEqual(data.attackPhases!.crouchPunch!.active,data.attackPhases!.crouchKick!.active);
  assert.notDeepEqual(data.attackPhases!.special!.active,data.attackPhases!.kick!.active);
 });
}
test('Dudley kicks and Elena palms use complete adapted frames instead of planted guard clips',()=>{
 for(const [id,actions] of [['dudley',['kick','crouchKick']],['kai',['punch','crouchPunch']]] as const){
  const data=load(id);for(const action of actions)for(const key of data.attackPhases![action]!.active)assert.ok(key.startsWith('adapted-'));
 }
 const ken=load('ken');for(const key of ken.attackPhases!.special!.active)assert.ok(key.startsWith('review-ryu-3650-'),'Ken uppercut must not use Hadoken art');
});
