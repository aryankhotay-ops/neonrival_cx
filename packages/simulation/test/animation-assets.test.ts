import { test } from 'node:test';
import { ok } from 'node:assert';
import { readFileSync } from 'node:fs';

test('Ryu action sequences reference available atlas frames',()=>{
 const data=JSON.parse(readFileSync(new URL('../../../apps/client/public/assets/sf3/ryu-animations.json',import.meta.url),'utf8')) as {frames:Record<string,number>,actions:Record<string,{key:string,duration:number}[]>};
 for(const action of ['idle','walk','back','jump','punch','kick','crouch','crouchPunch','crouchKick','special','super','fall','landing','rise']){
  const frames=data.actions[action];ok(frames.length>=(action==='crouch'?1:2),`${action} needs its animation frames`);
  for(const frame of frames)ok(Number.isInteger(data.frames[frame.key])&&frame.duration>0,`${action} has a valid frame and duration`);
 }
});

test('all fighter animations reference frames inside their sprite atlases',()=>{
 for(const character of ['elena','gill','ryu','ken','dudley']){
  const base=new URL(`../../../apps/client/public/assets/sf3/${character}-animations`,import.meta.url);
  const data=JSON.parse(readFileSync(`${base.pathname}.json`,'utf8')) as {frames:Record<string,number>,actions:Record<string,{key:string,duration:number}[]>};
  const png=readFileSync(`${base.pathname}.png`);const width=png.readUInt32BE(16),height=png.readUInt32BE(20);const count=width/200*height/180;
  for(const action of ['idle','walk','back','jump','punch','kick','crouch','crouchPunch','crouchKick','special','super','fall','landing','down','rise']){
   ok(data.actions[action]?.length,`${character} needs ${action} frames`);
   for(const frame of data.actions[action])ok(Number.isInteger(data.frames[frame.key])&&data.frames[frame.key]>=0&&data.frames[frame.key]<count&&frame.duration>0,`${character} ${action} points to a valid frame`);
  }
  if(character==='dudley')for(const frame of data.actions.kick)ok(frame.key.startsWith('120-'),'Dudley kick must use the guard pose, not the old fall frames');
 }
});
