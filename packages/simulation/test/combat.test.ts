import { test } from 'node:test';
import { equal, ok, deepStrictEqual } from 'node:assert';
import { createInitialState, step, NEUTRAL, type Input, type GameState } from '../src/index';
const blank=():Input=>({...NEUTRAL});
function advance(s:GameState,n:number,a:Input=blank(),b:Input=blank()){for(let i=0;i<n;i++)s=step(s,[a,b]);return s;}
function close():GameState {const s=createInitialState();s.fighters[0].x=4000;s.fighters[1].x=4700;return s;}
test('attack damages and awards meter; a landed punch can cancel into special',()=>{let s=step(close(),[{...blank(),punch:true},blank()]);s=advance(s,5);equal(s.fighters[1].health,96);ok(s.fighters[0].meter>0);s=step(s,[{...blank(),special:true},blank()]);equal(s.fighters[0].move,'special');s=advance(s,13);equal(s.fighters[1].health,87);equal(s.fighters[0].combo,2);});
test('holding away blocks high attack and timed forward parries it',()=>{let s=step(close(),[{...blank(),punch:true},{...blank(),right:true}]);s=advance(s,5,blank(),{...blank(),right:true});equal(s.fighters[1].health,100);ok(s.fighters[1].stun>0);s=step(close(),[{...blank(),punch:true},blank()]);s=advance(s,2);s=step(s,[blank(),{...blank(),left:true}]);s=advance(s,2);equal(s.fighters[1].health,100);ok(s.fighters[1].flash>0);});
test('super requires a full meter and rounds resolve to a match result',()=>{let s=step(close(),[{...blank(),super:true},blank()]);equal(s.fighters[0].move,null);s.fighters[0].meter=100;s=step(s,[blank(),blank()]);s=step(s,[{...blank(),super:true},blank()]);equal(s.fighters[0].move,'super');equal(s.fighters[0].meter,0);s.fighters[1].health=1;s=advance(s,15);equal(s.phase,'roundEnd');equal(s.fighters[0].wins,1);s=advance(s,150);equal(s.round,2);s=advance(s,90);s.fighters[1].health=0;s=step(s);s=advance(s,150);equal(s.phase,'matchEnd');equal(s.winner,1);});
test('replaying identical inputs produces identical states',()=>{let a=close(),b=close();for(let i=0;i<250;i++){const input:[Input,Input]=[{...blank(),right:i<15,punch:i===20},{...blank(),left:i>25&&i<31}];a=step(a,input);b=step(b,input);}deepStrictEqual(a,b);});
test('events describe actual hit, block, and parry outcomes deterministically',()=>{
  const simulate=(defender:(frame:number)=>Input)=>{let s=step(close(),[{...blank(),punch:true},blank()]);const events=[...s.events];for(let i=0;i<6;i++){s=step(s,[blank(),defender(i)]);events.push(...s.events);}return events;};
  const hit=simulate(()=>blank());ok(hit.some(e=>e.type==='attack'));ok(hit.some(e=>e.type==='hit'));ok(!hit.some(e=>e.type==='block'||e.type==='parry'));
  const block=simulate(()=>({...blank(),right:true}));ok(block.some(e=>e.type==='block'));ok(!block.some(e=>e.type==='hit'));
  const parry=simulate(i=>({...blank(),left:i>=2}));ok(parry.some(e=>e.type==='parry'));ok(!parry.some(e=>e.type==='hit'));
  deepStrictEqual(hit,simulate(()=>blank()));
});
test('fighter selection affects movement and persists into round two',()=>{
 let s=createInitialState(['vex','kai']);s=step(s,[{...blank(),right:true},{...blank(),left:true}]);equal(s.fighters[0].x,2776);equal(s.fighters[1].x,6816);
 s.fighters[1].health=0;s=step(s);s=advance(s,150);deepStrictEqual(s.fighters.map(p=>p.character),['vex','kai']);
});
test('each attack button starts its corresponding move state for every fighter',()=>{
 for(const character of ['kai','vex','ryu','ken','dudley'] as const){
  for(const action of ['punch','kick','special','super'] as const){
   const s=createInitialState([character,'ryu']);if(action==='super')s.fighters[0].meter=100;
   const next=step(s,[{...blank(),[action]:true},blank()]);equal(next.fighters[0].move,action,`${character} ${action}`);
  }
 }
});
test('Ryu Hadoken travels; Ken uses a close-range Shoryuken instead of a projectile',()=>{
 let s=createInitialState(['ryu','ken']);s=step(s,[{...blank(),special:true},blank()]);s=advance(s,12);equal(s.projectiles.length,1);const old=s.projectiles[0].x;s=step(s);ok(s.projectiles[0].x>old);s=advance(s,60);ok(s.fighters[1].health<100);equal(s.projectiles.length,0);
 s=createInitialState(['ken','ryu']);s.fighters[0].x=4000;s.fighters[1].x=4800;s=step(s,[{...blank(),special:true},blank()]);equal(s.fighters[0].move,'special');s=advance(s,12);ok(s.fighters[1].health<100);equal(s.projectiles.length,0);
});
test('knockout fall finishes during the round-end pause and stays down',()=>{
 let s=close();s.fighters[1].health=1;s=step(s,[{...blank(),down:true,kick:true},blank()]);s=advance(s,11);equal(s.phase,'roundEnd');ok(s.fighters[1].y<4000);s=advance(s,35);equal(s.fighters[1].y,4000);ok(s.fighters[1].knockdown>0);equal(s.fighters[1].health,0);
});

test('Gill uses Moonsault Knee Drop and Resurrection while Elena advances with Rhino Horn',()=>{
 let gill=createInitialState(['vex','kai']);gill.fighters[0].x=4000;gill.fighters[1].x=4800;gill=step(gill,[{...blank(),special:true},blank()]);gill=advance(gill,11);ok(gill.fighters[1].health<100);equal(gill.projectiles.length,0);
 gill.fighters[0].health=55;gill.fighters[0].meter=100;gill=step(gill,[blank(),blank()]);gill=step(gill,[{...blank(),super:true},blank()]);let healed=false;for(let i=0;i<17;i++){gill=step(gill);healed ||= gill.events.some(e=>e.type==='heal');}equal(gill.fighters[0].health,90);ok(healed);
 let elena=createInitialState(['kai','vex']);const start=elena.fighters[0].x;elena=step(elena,[{...blank(),special:true},blank()]);elena=advance(elena,10);ok(elena.fighters[0].x>start);equal(elena.projectiles.length,0);
});

test('Dudley uses an advancing boxing special and a meter-gated super',()=>{
 let s=createInitialState(['dudley','ryu']);const start=s.fighters[0].x;
 s=step(s,[{...blank(),special:true},blank()]);s=advance(s,10);
 equal(s.fighters[0].move,'special');ok(s.fighters[0].x>start);equal(s.projectiles.length,0);
 s=createInitialState(['dudley','ryu']);s=step(s,[{...blank(),super:true},blank()]);equal(s.fighters[0].move,null);
 s.fighters[0].meter=100;s=step(s,[blank(),blank()]);s=step(s,[{...blank(),super:true},blank()]);equal(s.fighters[0].move,'super');equal(s.fighters[0].meter,0);
});
